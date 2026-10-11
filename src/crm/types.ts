// Tipi condivisi per il CRM Bio-Mimetic
// I lead sono salvati come JSONB in DB ma esposti tipizzati lato client.

//  L'unico import di questo file, ed è di SOLO TIPO: "video" | "image" è già
//  definito in media/galleria.ts, che è il modulo che il carosello e le
//  raccolte pubbliche leggono. Riscriverne qui una copia gemella significa che
//  il giorno in cui uno dei due cresce (un "audio", un "pdf") l'altro resta
//  indietro senza che niente lo dica. `import type` sparisce alla
//  compilazione: nel pacchetto mandato al browser non entra nulla.
import type { TipoMedia } from "@/media/galleria";

export type LeadStatus =
  // ── STATI DI PRIMO CONTATTO ──────────────────────────────────────────────
  //  Mancavano, e senza di loro l'archivio storico non si poteva importare:
  //  oltre duecento lead annullati, trenta senza risposta e una decina in
  //  segreteria sarebbero finiti tutti nello stesso mucchio, perdendo l'unica
  //  informazione che dice cosa è successo davvero.
  | "da_contattare"
  | "non_risponde"
  | "segreteria"
  | "richiamo"
  | "annullato"
  | "appuntamento_fissato"
  //  ── L'APPUNTAMENTO DI CHI ERA GIÀ PASSATO DI QUI ───────────────────────
  //   Un contatto che risulta già in archivio e che si riporta a un
  //   appuntamento non è un lead nuovo: è un RIENTRO. Segnarlo come
  //   "Appuntamento fissato" avrebbe funzionato, ma avrebbe cancellato l'unica
  //   informazione che conta per chi lo richiama — «con questa persona ci
  //   abbiamo già parlato, e a suo tempo era finita in un certo modo».
  //   Vale quanto un appuntamento fissato (stessa fase, stesso peso nei conti):
  //   cambia solo che dice da dove arriva.
  | "appuntamento_rifissato"
  // ── ESITO DELL'APPUNTAMENTO ─────────────────────────────────────────────
  //  Dire "com'è andato l'appuntamento" e "a che punto è il lead" sono
  //  due domande diverse: senza questi tre, un appuntamento saltato e uno da
  //  riprogrammare finivano entrambi in "no show", e la differenza — uno è
  //  perso, l'altro è solo spostato — spariva.
  //  ⚠️ "fatto" È STORICO E NON SI ASSEGNA PIÙ. Resta nel tipo perché in
  //  archivio ci sono schede che ce l'hanno e devono continuare a leggersi e a
  //  contare fra le consulenze svolte. Da oggi "svolta" non è uno stato ma un
  //  CALCOLO: è svolto tutto ciò che non è "Cliente assente" né "Da
  //  riprogrammare" (vedi eStatoNonSvolta qui sotto). Si smette di assegnarlo,
  //  non di riconoscerlo.
  | "fatto"
  | "non_fatto"
  | "da_spostare"
  //  ⚠️ "venduto" È STORICO E NON SI ASSEGNA PIÙ: stesso trattamento di
  //  "fatto". Resta nel tipo perché l'archivio ne è pieno e quelle schede
  //  devono continuare a leggersi e a contare fra le conversioni. Diceva una
  //  cosa sola — «ha comprato» — e si fermava lì: chi apriva la riga il giorno
  //  dopo doveva comunque cercare da qualche altra parte COME arriva l'impianto,
  //  che è l'unica informazione che cambia il lavoro di tutti quelli che
  //  vengono dopo (agenda, tecnico, magazzino). Da oggi lo dicono i tre stati
  //  qui sotto, che sono la stessa notizia detta per intero.
  | "venduto"
  // ── LE TRE CHIUSURE VINTE ────────────────────────────────────────────────
  //  Un lead vinto si chiude in uno di questi tre, mai in un generico
  //  "venduto": la vendita e il modo in cui l'impianto arriva al cliente sono
  //  la stessa decisione, presa nello stesso momento, da chi ha il cliente
  //  davanti. Hanno di proposito la FORMA dei tre modi di consegna che
  //  esistono già in installazione.spedizione.modo ("sede" | "domicilio" |
  //  "spedizione"): «Nel nostro centro» mancava soltanto perché lì il caso in
  //  sede è il valore di partenza e non aveva bisogno di un nome.
  //  ⚠️ NON SOSTITUISCONO QUEL CAMPO, gli stanno accanto: `modo` decide se la
  //  pratica entra in agenda e occupa un tecnico, lo stato decide fase, colore
  //  e conteggi. Chi scrive l'uno aggiorni ANCHE l'altro, altrimenti si ottiene
  //  un lead «Da spedire» che continua a occupare un posto in calendario — e
  //  quel posto lo si scopre vuoto la mattina stessa.
  //  Il prefisso comune "posa_" non è un vezzo: sono tre stati che si cercano
  //  sempre insieme, e il giorno che se ne aggiunga un quarto lo si trova con
  //  un grep solo.
  //  ⚠️ "posa_in_sede" NON È "viene_in_sede": il secondo è il cliente atteso in
  //  sede per una VISITA (la vendita deve ancora avvenire, fase "in corso"), il
  //  primo è la vendita già fatta con la posa da noi. Due parole quasi uguali
  //  per due momenti opposti: qui si guarda il prefisso, non la parola "sede".
  | "posa_in_sede"
  | "posa_a_domicilio"
  | "posa_da_spedire"
  | "acconto" // automatico quando payment.accontoPagato > 0
  | "in_attesa_acconto"
  //  ── AVEVA DETTO SÌ, POI HA CAMBIATO IDEA ─────────────────────────────────
  //   L'uscita negativa di «Attesa acconto», che prima non esisteva: chi aveva
  //   accettato e all'ultimo si è tirato indietro finiva in «Non interessato»
  //   — che dice un'altra cosa, cioè che non l'ha mai voluto — oppure restava
  //   in attesa di un acconto che non sarebbe mai arrivato, tenendo occupata
  //   una coda di solleciti per sempre.
  //   ⚠️ NON è «Cliente assente» (non si è presentato) né «Perditempo» (non
  //   aveva mai intenzione di comprare): qui la trattativa era chiusa bene, e
  //   si è disfatta sul più bello. È l'informazione che serve a capire dove si
  //   perde davvero il fatturato, e schiacciarla su «Non interessato» la
  //   cancellava.
  | "ripensamento"
  | "viene_in_sede"
  //  Chi aveva fissato in sede e ha annullato NON è perso: è un appuntamento
  //  da riprendere. Finiva in "Cliente assente" (che vuol dire un'altra cosa:
  //  non si è presentato senza avvisare) oppure fra i non interessati, e da lì
  //  non lo richiamava più nessuno.
  | "sede_disdetta"
  | "gestire_in_chat"
  | "sta_valutando"
  // ── IL CLIENTE CHE SI È ZITTITO ──────────────────────────────────────────
  //  La consulenza c'è stata, il preventivo è partito, e da lì in poi non
  //  risponde più: né un sì, né un no. Finiva schiacciato fra "In valutazione"
  //  (che promette una risposta che non arriva mai) e "Non interessato" (che
  //  dichiara persa una trattativa che nessuno ha ancora perso), e in tutti e
  //  due i casi l'informazione vera — «abbiamo provato, non ci risponde» — non
  //  la sapeva più nessuno.
  //  Sta in sospeso, non fra i persi: è ambra, cioè manca ancora un'azione. Un
  //  cliente muto torna a parlare più spesso di quanto si creda, ed è
  //  esattamente la coda che va ripresa quando il telefono è fermo.
  //  ⚠️ NON confonderlo con "non_risponde": quello è il telefono che squilla a
  //  vuoto mentre si lavora una lista (fase "da lavorare", il lead è ancora
  //  tutto da conoscere). Questo è una persona che conosciamo, che ha già
  //  ricevuto un preventivo, e che ha smesso di rispondere.
  | "irreperibile"
  | "da_ricontattare"
  //  ── RICHIAMA LUI, NON NOI ───────────────────────────────────────────────
  //   Richiesta del committente: «aggiungi come stato "ci ricontatta lui", e
  //   segna in dinamico la data di quando lo ha detto — quella di oggi,
  //   sempre — e quando dice che ricontatta. Per il setter sui lead importati
  //   e sui lead effettivi».
  //   ⚠️ NON È `da_ricontattare`, ed è tutta la differenza: lì il richiamo è
  //    un nostro impegno — il lead entra nelle code di lavoro e qualcuno deve
  //    chiamarlo. Qui la palla ce l'ha il cliente: ha detto che si fa vivo
  //    lui. Schiacciare le due cose sullo stesso stato vuol dire o richiamare
  //    chi ha chiesto di non essere richiamato, o aspettare per sempre una
  //    telefonata che non arriva — perché nessuno sa più di chi era il turno.
  //   La data entro cui dovrebbe farsi vivo si chiede lo stesso
  //    (`QUANDO_PER_STATO`): è quella che riporta la scheda in coda se quel
  //    giorno passa senza notizie.
  | "ci_ricontatta_lui"
  | "fissa_meet_dopo"
  | "no_show"
  | "perdi_tempo"
  //  ⚠️ "concluso" È STORICO E NON SI SCEGLIE PIÙ DA UN MENU, stesso
  //  trattamento di "fatto" e "venduto". Resta nel tipo — l'archivio ne è pieno
  //  — e resta RAGGIUNGIBILE per via automatica: `chiudiTrattativa()` qui sotto
  //  lo scrive ancora, perché archiviare una pratica è un gesto suo, con il suo
  //  pulsante e il suo ritorno indietro. Quello che sparisce è la voce in mezzo
  //  agli esiti: "Chiuso" accanto a "Venduto" era la coppia più ambigua del
  //  menu — nessuna delle due diceva com'era finita davvero.
  | "concluso";

// ── LE ETICHETTE DICONO COSA È SUCCESSO ────────────────────────────────────
//  Regole applicate a tutte e venti:
//   · una sola maiuscola all'inizio: "Da Contattare" scritto a maiuscole
//     sparse è più lento da leggere e non è italiano corretto;
//   · nessuna coppia ambigua. Prima "Non fatto" e "No Show" sembravano la
//     stessa cosa — sono opposte: la prima è un appuntamento da riprovare, la
//     seconda è un cliente che non si è presentato e il lead è perso.
//     Stesso problema fra "Richiamo", "Da Ricontattare" e "Fissa Meet Dopo":
//     tre etichette per tre momenti diversi che si leggevano uguali;
//   · niente gergo interno da mostrare al cliente ("Perdi Tempo").
//  I VALORI interni non cambiano: cambia solo ciò che si legge a schermo,
//  così l'archivio storico e gli import restano validi.
export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  da_contattare: "Da contattare",
  non_risponde: "Non risponde",
  segreteria: "Segreteria",
  //  Il cliente ha chiesto lui di essere richiamato, e c'è un orario: è una
  //  cosa diversa dal generico "da contattare".
  richiamo: "Richiamo concordato",
  //  Il valore resta "annullato" (lo usa l'import), ma il significato reale è
  //  "per ora lascia perdere": l'etichetta lo dice senza farlo confondere con
  //  un appuntamento annullato.
  annullato: "Non interessato",
  ripensamento: "Ripensamento",
  appuntamento_fissato: "Appuntamento fissato",
  //  Si legge "ri-fissato" ma si scrive unito: è la forma corretta in italiano
  //  ed è la stessa parola che il CRM usa già quando un appuntamento saltato
  //  viene ripreso ("Appuntamento rifissato" nel diario delle note). Due
  //  grafie per la stessa cosa costringerebbero a chiedersi se sono due cose.
  appuntamento_rifissato: "Appuntamento rifissato",
  //  Stato STORICO: non lo si assegna più (una consulenza è svolta per
  //  esclusione, non perché qualcuno l'ha marcata). L'etichetta però resta
  //  quella giusta: sulle schede vecchie quel valore vuol dire esattamente
  //  "la consulenza c'è stata", e riscriverla renderebbe illeggibile l'archivio.
  fatto: "Consulenza svolta",
  //  Stato STORICO: non lo si assegna più (lo sostituisce "Cliente assente"),
  //  ma nell'archivio ce n'è, e deve leggersi come ciò che è.
  non_fatto: "Cliente assente",
  da_spostare: "Da riprogrammare",
  //  Stato STORICO: non lo si assegna più, lo dicono per intero le tre chiusure
  //  qui sotto. L'etichetta resta questa: sulle schede vecchie quel valore vuol
  //  dire esattamente "ha comprato", e riscriverla renderebbe illeggibile
  //  l'archivio.
  venduto: "Venduto",
  //  ── LE TRE CHIUSURE VINTE, DETTE COME LE DICE IL CLIENTE ───────────────
  //   "Nel nostro centro" è la stessa frase che il preventivo pubblico usa già
  //   per la posa in sede (shop/quote-menu.ts), e le altre due sono i nomi con
  //   cui le due schede delle installazioni si chiamano già a schermo. Una
  //   lingua sola fra quello che il cliente legge, quello che dice il menu e
  //   quello che c'è sulla pastiglia: chi risponde al telefono non deve
  //   tradurre niente.
  posa_in_sede: "Nel nostro centro",
  posa_a_domicilio: "A domicilio",
  posa_da_spedire: "Da spedire",
  acconto: "Acconto incassato",
  in_attesa_acconto: "Attesa acconto",
  viene_in_sede: "Appuntamento in sede",
  sede_disdetta: "Appuntamento in sede disdetto",
  //  L'entità qui dentro si chiama LEAD ovunque, a schermo e a voce: dire
  //  "trattativa" in una sola pastiglia costringeva a tradurre mentalmente fra
  //  il menu ("Lead") e la scheda. Il VALORE resta gestire_in_chat.
  gestire_in_chat: "Lead in chat",
  sta_valutando: "In valutazione",
  //  Una parola sola, e professionale: dice che non si riesce più a raggiungere
  //  la persona senza pronunciare una sentenza su di lei. "Non risponde più"
  //  sarebbe stato identico all'etichetta di un MOTIVO PERSO che esiste già
  //  (LOST_REASON_LABEL.non_risponde) e quasi identico allo stato di primo
  //  contatto "Non risponde": tre diciture uguali per tre cose diverse.
  irreperibile: "Irreperibile",
  //  Data e ora ci sono già: non è "da ricontattare un giorno", è fissato.
  da_ricontattare: "Ricontatto fissato",
  //  Le parole del committente, e si leggono da sole: la palla ce l'ha lui.
  ci_ricontatta_lui: "Ci ricontatta lui",
  fissa_meet_dopo: "Meet da fissare",
  no_show: "Cliente assente",
  //  "Non in target" è il linguaggio del marketing e non dice cosa è
  //  successo davvero al telefono.
  perdi_tempo: "Perditempo",
  //  Al maschile perché concorda con "lead": "Chiusa" era rimasto dai tempi in
  //  cui la riga si chiamava trattativa, e in mezzo a un elenco di lead una
  //  pastiglia femminile fa cercare per un attimo il sostantivo mancante.
  concluso: "Chiuso",
};

// ── IL COLORE RISPONDE A UNA DOMANDA SOLA ──────────────────────────────────
//  "A che punto è questo lead?" — non "quale dei venti stati è", che lo
//  dice già l'etichetta. Venti colori diversi obbligavano a impararli a
//  memoria: rosa e viola non significano niente finché qualcuno non te lo
//  spiega, e su una lista di ottocento righe il colore diventava rumore.
//  Con sei fasi la lista si legge da lontano: verde = incassato, rosso =
//  perso, ambra = manca qualcosa da fare, e tutto il resto è lavoro in corso.
export type LeadPhase =
  | "da_lavorare" // mai lavorata o ancora al telefono
  | "in_corso" // lead aperto, si sta muovendo
  | "in_sospeso" // ferma in attesa di un'azione (nostra o del cliente)
  | "vinta"
  | "persa"
  | "chiusa"; // pratica archiviata: non è né vinta né persa, è finita

//  Le etichette concordano con "lead" (maschile): le CHIAVI restano al
//  femminile perché sono nomi interni e rinominarle romperebbe ogni riferimento
//  senza aggiungere niente a chi legge lo schermo.
export const LEAD_PHASE_LABEL: Record<LeadPhase, string> = {
  da_lavorare: "Da lavorare",
  in_corso: "In corso",
  in_sospeso: "In sospeso",
  vinta: "Vinto",
  persa: "Perso",
  chiusa: "Chiuso",
};

//  Classi scritte per esteso: Tailwind legge il sorgente, quindi comporre i
//  nomi delle classi a runtime le farebbe sparire dal CSS finale.
export const LEAD_PHASE_COLOR: Record<LeadPhase, string> = {
  da_lavorare: "bg-sky-500/15 text-sky-700 border-sky-500/30",
  in_corso: "bg-indigo-500/15 text-indigo-700 border-indigo-500/30",
  in_sospeso: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  vinta: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  persa: "bg-rose-500/15 text-rose-700 border-rose-500/30",
  chiusa: "bg-slate-500/15 text-slate-700 border-slate-500/30",
};

/** Pallino pieno, per le liste fitte dove non c'è spazio per un cartellino. */
export const LEAD_PHASE_DOT: Record<LeadPhase, string> = {
  da_lavorare: "bg-sky-500",
  in_corso: "bg-indigo-500",
  in_sospeso: "bg-amber-500",
  vinta: "bg-emerald-500",
  persa: "bg-rose-500",
  chiusa: "bg-slate-400",
};

export const LEAD_STATUS_PHASE: Record<LeadStatus, LeadPhase> = {
  // Prima della consulenza: si sta ancora cercando di parlarci.
  da_contattare: "da_lavorare",
  non_risponde: "da_lavorare",
  segreteria: "da_lavorare",
  richiamo: "da_lavorare",
  // Lead aperto: c'è un appuntamento o un discorso in corso.
  appuntamento_fissato: "in_corso",
  //  Stessa fase dell'appuntamento fissato, quindi stesso colore: nella lista
  //  un appuntamento è un appuntamento, che il cliente sia nuovo o di ritorno.
  appuntamento_rifissato: "in_corso",
  //  "Consulenza svolta" era verde come "Venduto": il verde prometteva un
  //  incasso che non c'era. La consulenza fatta è solo un lead ancora aperto.
  fatto: "in_corso",
  viene_in_sede: "in_corso",
  gestire_in_chat: "in_corso",
  sta_valutando: "in_corso",
  da_ricontattare: "in_corso",
  //  In corso, non in sospeso: il discorso è aperto e la risposta deve
  //  arrivare: è ambra solo quando il giorno promesso è passato, e di quello
  //  si occupa la data, non lo stato.
  ci_ricontatta_lui: "in_corso",
  fissa_meet_dopo: "in_corso",
  // Ferme: manca un passaggio concreto perché ripartano.
  non_fatto: "in_sospeso",
  da_spostare: "in_sospeso",
  in_attesa_acconto: "in_sospeso",
  //  In sospeso e NON persa: nessuno ha detto di no, semplicemente non risponde
  //  più. Metterla fra le perse avrebbe fatto sparire dalla vista l'unica coda
  //  che vale la pena riprendere quando il telefono è fermo.
  irreperibile: "in_sospeso",
  // Chiuse bene.
  venduto: "vinta",
  //  Le tre chiusure vinte pesano quanto pesava "venduto", né più né meno: nella
  //  lista si vedono verdi da lontano e nei conti valgono una conversione. La
  //  differenza fra loro riguarda chi organizza la consegna, non chi legge il
  //  totale del mese.
  posa_in_sede: "vinta",
  posa_a_domicilio: "vinta",
  posa_da_spedire: "vinta",
  acconto: "vinta",
  // Chiuse male.
  annullato: "persa",
  //  Persa, non in sospeso: chi ci ha ripensato ha detto di no, e tenerlo fra
  //  le pratiche aperte gonfierebbe le code di lavoro con gente che non aspetta
  //  più niente. Che sia una perdita RECUPERABILE è un'altra domanda, e si fa
  //  richiamandolo — non lasciandolo ambra in un elenco.
  ripensamento: "persa",
  sede_disdetta: "in_sospeso",
  no_show: "persa",
  perdi_tempo: "persa",
  // Archiviata.
  concluso: "chiusa",
};

/** La fase di uno stato: usarla al posto di elenchi di stati sparsi nel codice. */
export function fasePer(stato: LeadStatus): LeadPhase {
  return LEAD_STATUS_PHASE[stato] ?? "da_lavorare";
}

// ── COSA NON È UNA CONSULENZA SVOLTA ───────────────────────────────────────
//  IL CRITERIO STA QUI, IN UN POSTO SOLO, e da qui lo leggono l'agenda, i
//  totali del giorno, le lenti e i filtri dell'elenco lead. Regola del
//  committente: «sono svolte tutte tranne quei due stati».
//   · Cliente assente  → no_show (e il vecchio non_fatto, che dice la stessa
//     cosa e nell'archivio esiste ancora): il cliente non c'era;
//   · Da riprogrammare → da_spostare: l'incontro è saltato e aspetta una data.
//  Tutto il resto — venduto, acconto, visita in sede, "sta valutando",
//  ricontatto fissato, lead in chat, non interessato, chiuso, e le schede
//  storiche segnate "fatto" — È una consulenza avvenuta.
//  Chiedere ANCHE uno stato "fatto" accanto a questi voleva dire chiedere due
//  volte la stessa cosa: chi segnava subito il venduto si vedeva sparire la
//  consulenza dal totale della giornata.
export const STATI_NON_SVOLTA: LeadStatus[] = ["no_show", "non_fatto", "da_spostare"];

/** Vero se questo stato dice che la consulenza NON è avvenuta.
 *  Accetta anche valori sconosciuti: lo stato arriva dal database e non è detto
 *  che sia uno dei nostri — uno stato mai visto non è una prova che il cliente
 *  fosse assente, quindi risponde `false` e la scheda resta fra le svolte. */
export function eStatoNonSvolta(stato?: LeadStatus | string | null): boolean {
  return (STATI_NON_SVOLTA as string[]).includes(String(stato ?? ""));
}

// ── UN APPUNTAMENTO È UN APPUNTAMENTO ──────────────────────────────────────
//  Da quando esiste "Appuntamento rifissato" (il cliente di ritorno) gli stati
//  che significano «c'è un incontro in calendario» sono DUE. Ogni riga che
//  scrive `stato === "appuntamento_fissato"` — agenda, meet del giorno, conti
//  della giornata, promemoria — da sola perderebbe il secondo, e il lead
//  sparirebbe dall'agenda pur avendo data e ora: si legge da qui, in un posto
//  solo, così aggiungerne un terzo un giorno non costerà una caccia al grep.
export const STATI_APPUNTAMENTO: LeadStatus[] = ["appuntamento_fissato", "appuntamento_rifissato"];

/** Vero se questo stato dice che c'è un appuntamento in calendario.
 *  Accetta stringhe grezze: lo stato arriva dal database e può essere un
 *  valore mai visto, che non è un appuntamento finché non lo diventa. */
export function eAppuntamento(stato?: LeadStatus | string | null): boolean {
  return (STATI_APPUNTAMENTO as string[]).includes(String(stato ?? ""));
}

// ── UNA VENDITA È UNA VENDITA ──────────────────────────────────────────────
//  I tre modi in cui si chiude vinto un lead. Sono ASSEGNABILI: è fra questi
//  che si sceglie quando il cliente ha comprato, e la scelta dice anche come
//  gli arriva l'impianto.
//  Si legge da qui, in un posto solo, per la stessa ragione di
//  STATI_APPUNTAMENTO: ogni riga che scrive `stato === "venduto"` ne conosce
//  uno solo, e con tre stati al posto di uno quella riga smette di funzionare
//  in silenzio — che è il modo peggiore, perché il numero appare, è solo
//  sbagliato.
export const STATI_CHIUSURA_VINTA: LeadStatus[] = [
  "posa_in_sede",
  "posa_a_domicilio",
  "posa_da_spedire",
];

/** Tutto ciò che significa «questo lead ha comprato», storia compresa.
 *  ⚠️ "venduto" ci deve stare: non si assegna più, ma in archivio ce n'è a
 *  centinaia e quelle schede devono continuare a contare esattamente come
 *  prima. "acconto" ci sta perché il denaro è entrato davvero ed è già in fase
 *  "vinta" (lo assegna da sé applyAutoStatus quando l'acconto supera lo zero).
 *  NON c'è "concluso": una pratica archiviata non è detto che sia stata vinta,
 *  ed è la stessa scelta — dichiarata e voluta — che fa STATI_CONVERSIONE nei
 *  KPI. */
export const STATI_VINTI: LeadStatus[] = [...STATI_CHIUSURA_VINTA, "venduto", "acconto"];

/** Vero se questo stato dice che il lead è stato vinto.
 *  Accetta stringhe grezze come le sorelle qui sopra: lo stato arriva dal
 *  database e uno stato mai visto non è una vendita finché non lo diventa. */
export function eChiusuraVinta(stato?: LeadStatus | string | null): boolean {
  return (STATI_VINTI as string[]).includes(String(stato ?? ""));
}

// ── «L'IMPIANTO È ADDOSSO AL CLIENTE?» ─────────────────────────────────────
//  Una domanda sola, una risposta sola, e NON è lo stato del lead.
//  Sta qui e non nel modulo installazioni — dove la regola viveva prima, come
//  `posaCompletata` — per una ragione pratica: la deve leggere anche crm/ui.tsx
//  (il badge «Installazioni» del menu conta le pose ancora da fare), e ui.tsx
//  non può importare InstallationScheduleDialog perché quello importa già da
//  ui.tsx: si chiuderebbe il cerchio. La conseguenza, finché la regola stava
//  di là, era che l'unica strada praticabile era RICOPIARLA — e infatti era
//  ricopiata, con il risultato che il badge del menu poteva contare una cosa e
//  la pagina un'altra, in silenzio. Da types.ts la leggono tutti e due.
/** Vero se la posa risulta eseguita.
 *  ⚠️ IL RIPIEGO SULLO STATO SERVE SOLO ALL'ARCHIVIO, e non si può togliere:
 *   prima che esistesse `installazione.completataIl`, «posa fatta» si diceva
 *   mettendo il lead in "venduto" dal modulo installazioni, e in archivio ci
 *   sono centinaia di schede così. Toglierlo le farebbe tornare tutte fra le
 *   pose da fare — cioè riaprirebbe un anno di lavoro già consegnato.
 *   Non c'è ambiguità con le vendite di oggi: "venduto" non è più assegnabile,
 *   quindi nessuna scheda nuova può inciamparci. Le tre `posa_*`, che sono i
 *   modi in cui si vince adesso, NON contano come posa fatta: si assegnano
 *   quando il cliente compra, cioè prima che il tecnico l'abbia toccato. */
export function posaFatta(d?: Pick<LeadData, "installazione" | "stato"> | null): boolean {
  if (d?.installazione?.completataIl) return true;
  return d?.stato === "venduto";
}

/** ── LO STATO DICE ANCHE COME ARRIVA L'IMPIANTO ───────────────────────────
 *  Le tre chiusure sono anche i tre modi di consegna, ed è tutto il senso di
 *  averne tre invece di un solo "venduto". Ma sono DUE campi che devono restare
 *  d'accordo: lo stato decide fase, colore e conteggi; `installazione.
 *  spedizione.modo` decide se la pratica occupa un tecnico in agenda o parte
 *  come pacco.
 *  ⚠️ Aggiornarne uno solo è il guasto silenzioso più caro che questo CRM
 *   conosca: un lead «Da spedire» che si tiene il posto in agenda lo si scopre
 *   la mattina stessa, con il tecnico già in viaggio.
 *  ⚠️ La tabella sta QUI, accanto agli stati, e non dentro la finestra che li
 *   scrive: i punti che registrano una vendita sono due e non uno — la finestra
 *   della chiusura sul computer (crm/ChiusuraDialog.tsx) e la rotta del telefono
 *   del consulente (routes/api.consulente.azione.ts) — e due copie della stessa
 *   tabella sono due copie che un giorno divergono. `spedizione.ts` non poteva
 *   ospitarla: importa React e sonner, e la rotta gira sul server.
 *  ⚠️ Se nasce una quarta chiusura e nessuno la aggiunge qui, non si scrive un
 *   modo SBAGLIATO: non si scrive niente e la consegna resta com'era. */
export const MODO_CONSEGNA_DA_STATO: Partial<
  Record<LeadStatus, "sede" | "domicilio" | "spedizione">
> = {
  posa_in_sede: "sede",
  posa_a_domicilio: "domicilio",
  posa_da_spedire: "spedizione",
};

//  Derivato dalla fase: aggiungere uno stato nuovo non richiede di inventare
//  un colore, basta dire in che fase sta.
export const LEAD_STATUS_COLOR: Record<LeadStatus, string> = Object.fromEntries(
  (Object.keys(LEAD_STATUS_PHASE) as LeadStatus[]).map((s) => [
    s,
    LEAD_PHASE_COLOR[LEAD_STATUS_PHASE[s]],
  ]),
) as Record<LeadStatus, string>;

export type LeadFonte = "ADV" | "Organico" | "Passa parola" | "Store";

export type PiattaformaAds = "meta" | "tiktok" | "none";

export type StatoPagamento = "nessun_pagamento" | "acconto_ricevuto" | "pagato_interamente";

export type StatoOrdine = "da_ordinare" | "ordinato" | "manca_colore" | "colore_preso";

export type TipoInstallazione = "da_impostare" | "taxi" | "indipendente";

export interface PaymentInfo {
  /** ── COME È STATO INCASSATO IL SALDO ────────────────────────────────────
   *  Serve al calcolo del netto: l'IVA si scorpora solo se l'incasso era con
   *  IVA, e senza questo dato il margine sarebbe sbagliato di un quinto.
   *  Lo scrive incassaSaldo() in crm/InstallationScheduleDialog.tsx. */
  incassoSaldo?: {
    conIva: boolean;
    aliquotaIva: number;
    importo: number;
    totaleIncassato: number;
    data: string;
  };

  /** ── IL REGISTRO DEGLI INCASSI, RIGA PER RIGA ────────────────────────────
   *  `accontoPagato` dice QUANTO è entrato in tutto, e `incassoSaldo` racconta
   *  l'ultimo movimento: nessuno dei due sa dire cosa è successo prima.
   *  Questo elenco sì. Ogni riga è un incasso vero, con la sua data, la sua
   *  cifra e il modo in cui l'IVA ci stava dentro.
   *
   *  ⚠️ SERVE PERCHÉ UN INCASSO PUÒ ESSERE DIVISO. Richiesta del committente:
   *   una parte con l'IVA compresa e un'altra parte con un trattamento diverso,
   *   nello stesso momento. Due trattamenti non stanno in un campo solo — e
   *   scritti come uno solo, il netto di quella pratica sarebbe sbagliato per
   *   costruzione.
   *
   *  ⚠️ NON SOSTITUISCE `accontoPagato`, che resta il totale su cui tutto il
   *   CRM fa i conti. Questo elenco lo AFFIANCA: le schede vecchie non ce
   *   l'hanno e devono continuare a funzionare, quindi nessun calcolo può
   *   pretenderlo. */
  incassi?: RigaIncasso[];

  /** ── ⚠️ QUANTO DEL PREZZO È TRACCIATO E QUANTO IN CONTANTI ──────────────
   *  Richiesta del committente, ed è una domanda di cassa, non di forma: di una
   *  pratica da 550 possono arrivare 450 per bonifico e 100 in mano. Chi tiene
   *  la contabilità deve sapere quale parte passa dalla banca; chi conta la
   *  cassa a fine giornata deve sapere quanto c'è nel cassetto.
   *  ⚠️ Si riferiscono al TOTALE della pratica, non al solo acconto: la parte
   *   in contanti può stare nell'acconto, nel saldo alla consegna o in tutti e
   *   due, e legarla a un solo momento vorrebbe dire non poterla dichiarare
   *   prima che quel momento arrivi.
   *  ⚠️ Facoltativi, e il loro assente NON vuol dire zero: le schede vecchie
   *   non li hanno, e leggerle come «tutto in contanti» racconterebbe una cosa
   *   che nessuno ha mai detto. `accontoPagato` resta il totale su cui tutto
   *   il CRM fa i conti: questi due lo SPIEGANO, non lo sostituiscono. */
  incassoTracciato?: number;
  incassoContanti?: number;
  prodotto?: string;
  prezzoTotale?: number;
  prezzoFinaleVendita?: number;
  accontoPagato?: number;
  saldoRimanente?: number;
  statoPagamento?: StatoPagamento;
  metodoPagamento?: string;
  dataPagamento?: string;
  pianoRate?: boolean;
  numeroRate?: number;
  importoRata?: number;
  prossimaScadenza?: string;
  costi?: {
    costoTaglio?: number;
    costoInstallatore?: number;
    costoProdotto?: number;
    /** ── QUANTO COSTA MANDARE IL PACCO ────────────────────────────────────
     *  Vale solo sulle pratiche che si SPEDISCONO, ed è il gemello di
     *  `costoTrasferta` qui sotto: uno è il viaggio che facciamo noi, l'altro
     *  è quello che fa il corriere. Su un pacco non esistono un installatore
     *  né un parrucchiere, e quei due costi si azzerano da soli (vedi
     *  `applyAutoStatus`): sommarli a una spedizione vorrebbe dire un margine
     *  più basso del vero su ogni pacco. */
    costoSpedizione?: number;
    /** ── IL VIAGGIO DELLA POSA A DOMICILIO ────────────────────────────────
     *  Quanto costa ANDARE dal cliente: benzina, pedaggi, ore di strada. Sta
     *  qui, insieme agli altri costi della pratica, per una ragione sola: è un
     *  costo, cioè un'uscita che il netto deve SOTTRARRE. Non è un incasso e
     *  non deve mai comparire nel totale da incassare né sommarsi al saldo del
     *  cliente — chi ci mette mano si ricordi che un costo contato come ricavo
     *  gonfia due numeri in una volta (la cassa e il margine).
     *  Lo scrive salvaCostoViaggio() in crm/spedizione.ts.
     *  ⚠️ kpi-netto.ts non lo sottrae ANCORA: costiDellaScheda() somma solo i
     *  tre costi storici. La riga da aggiungere là è scritta in "richieste":
     *  finché non c'è, questo costo è dichiarato e non ancora contato — che è
     *  l'errore meno grave dei due possibili. */
    costoTrasferta?: number;
    /** ── GLI ALTRI COSTI DI QUESTA PRATICA ───────────────────────────────
     *  I tre campi qui sopra sono i costi che TUTTE le pratiche hanno —
     *  l'impianto, chi lo installa, chi taglia — e restano campi loro perché
     *  è su quei tre che il CRM fa i conti da sempre.
     *  Questo è tutto il resto: la trasferta straordinaria, il ritocco dal
     *  parrucchiere di fiducia del cliente, il corriere, il rimborso. Ogni
     *  voce ha un titolo scritto a mano, perché non esiste un elenco chiuso
     *  che copra quello che succede davvero.
     *  ⚠️ ENTRANO NEL MARGINE COME GLI ALTRI (crm/kpi-netto e kpi-calcoli le
     *   sommano): una voce scritta e non contata è peggio di una non scritta,
     *   perché fa credere che il conto la comprenda. */
    altri?: VoceCosto[];
    ivaInclusa?: boolean;
  };
}

/** ── UN MOVIMENTO DI CASSA ────────────────────────────────────────────────
 *  Una riga del registro `payment.incassi`. `importo` è quello che è
 *  ENTRATO davvero — il totale, IVA compresa se c'era — e `imposta` è quanta
 *  IVA c'era dentro: scritte tutte e due, non se ne deve ricalcolare nessuna
 *  con un'aliquota che nel frattempo potrebbe essere cambiata. */
export interface RigaIncasso {
  id: string;
  /** ISO YYYY-MM-DD: il giorno in cui i soldi sono entrati, che non è sempre
   *  il giorno in cui qualcuno li ha registrati. */
  data: string;
  /** Quanto è entrato in tutto, IVA compresa. */
  importo: number;
  /** "inclusa" | "aggiunta" | "senza", come lo ha scelto chi ha registrato. */
  modoIva: string;
  aliquota: number;
  /** Quanta IVA c'è dentro `importo`. Zero con «senza». */
  imposta: number;
  /** Contanti, bonifico, carta: come è entrato. Vuoto = non è stato detto. */
  metodo?: string;
  /** La parte tracciata (bonifico, carta, POS) e quella in contanti di QUESTA
   *  riga. ⚠️ Assenti = non è stato detto, non «zero»: vedi i gemelli su
   *  PaymentInfo. */
  tracciato?: number;
  contanti?: number;
}

/** Una voce di costo scritta a mano: vale sia per i costi di una pratica
 *  (`payment.costi.altri`) sia per le spese fisse del mese (crm/costi-mese). */
export interface VoceCosto {
  id: string;
  /** «Corriere», «Affitto», «Fibra». Come lo chiama chi lo paga. */
  titolo: string;
  importo: number;
}

export interface ChecklistItem {
  label: string;
  done: boolean;
}

export interface InstallazioneInfo {
  dataInstallazione?: string;
  orarioInstallazione?: string;
  durataInstallazione?: number; // minuti, default 60
  //  Chi esegue la posa. Da oggi è per forza una persona dell'anagrafica a cui
  //  è segnato il mestiere «installatore» (vedi `esecutoriPossibili` in
  //  crm/InstallationScheduleDialog.tsx): è l'unico modo perché la posa gli
  //  tolga davvero il tempo dall'agenda.
  consulenteInstallazioneId?: string | null;
  /** ── UN NOME SCRITTO A MANO, DI QUANDO NON C'ERA ALTRO MODO ─────────────
   *  Il campo di testo libero «Tecnico che va a posare» che stava sotto «Chi la
   *  esegue» prima che l'accompagnatore si potesse SCEGLIERE fra le persone in
   *  anagrafica (`accompagnatoreId`, qui sotto).
   *  ⚠️ NON SI SCRIVE PIÙ, e NON SI CANCELLA: sulle schede vecchie è l'unica
   *  traccia di chi era stato messo su quella posa, e buttarla via avrebbe fatto
   *  sparire un nome che qualcuno aveva digitato apposta. Si LEGGE ancora — la
   *  finestra lo mostra finché su quella posa nessuno sceglie una persona vera,
   *  e `nomeTecnico`/`senzaTecnico` continuano a usarlo come ripiego per le
   *  pratiche d'archivio che non hanno un consulente collegato.
   *  ⚠️ Era, ed è rimasto, un NOME: non blocca nessuna agenda. È esattamente il
   *  motivo per cui è stato sostituito da una scelta. */
  tecnicoAssegnato?: string;
  noteInstallazione?: string;
  tipoInstallazione?: TipoInstallazione;
  /** ── CHI VA INSIEME A POSARE: L'ACCOMPAGNATORE ──────────────────────────
   *  L'id di un consulente a cui è segnato il MESTIERE «accompagnatore» (si
   *  legge da `mestieriDi()` in crm/kpi-setter.ts). È la seconda paia di mani
   *  sul lavoro: parte con l'installatore, sta lì per tutta la posa e torna con
   *  lui. Assente o vuoto = ci va da solo.
   *  ⚠️⚠️ NON È IL DRIVER, e i due campi non si fondono mai. Il driver è un
   *  SERVIZIO DI TRASPORTO — ha un compenso da pagare in più
   *  (`compensoDriver`), sta in strada tre ore prima e tre dopo, e lo si sceglie
   *  al passo «viene da solo o con un driver». L'accompagnatore il lavoro lo FA,
   *  e quel compenso non lo prende. Un campo solo per tutti e due avrebbe messo
   *  un pagamento addosso a chi non lo riceve. La stessa persona può essere
   *  entrambe le cose in giorni diversi: sono due spunte, non una scelta fra.
   *  ⚠️ Chi lo scrive occupa anche la sua agenda: booking-utils.ts gli blocca la
   *  fascia della posa più DUE ore di strada prima e due dopo — le stesse di chi
   *  esegue, perché è lo stesso viaggio. Lo scrive «Programma installazione». */
  accompagnatoreId?: string | null;
  /** ── CHI PORTA CHI VA A POSARE ──────────────────────────────────────────
   *  L'id di un consulente a cui è segnato il MESTIERE «driver» — che si legge
   *  da `mestieriDi()` in crm/kpi-setter.ts, insieme a setter e consulente, e
   *  NON da crm/permessi.ts: quel file dice cosa una persona può toccare ed è
   *  una scala su cui si sale, mentre guidare è un lavoro che si somma agli
   *  altri. Assente o vuoto = ci va da solo, che è il caso normale: l'assenza
   *  NON è «non lo
   *  sappiamo», è «nessuno», ed è la ragione per cui non esiste un booleano
   *  accanto — due campi per una domanda sola si contraddicono al primo salvataggio
   *  (`conDriver: true` con `driverId` vuoto è un driver che non esiste).
   *  ⚠️ Chi lo scrive occupa anche la sua agenda: booking-utils.ts blocca al
   *  driver la fascia della posa più TRE ore di strada prima e tre dopo, e lo fa
   *  sia per le installazioni sia per le consulenze, perché la persona è una
   *  sola. Lo scrive la procedura «Programma installazione». */
  driverId?: string | null;
  /** Quanto va pagato IN PIÙ perché la posa ha un driver, in euro.
   *  ⚠️ È UN COSTO, come il costo del viaggio: non si somma al saldo del
   *  cliente, non entra nel totale da incassare e non compare in nessuno dei tre
   *  numeri della riga. Sta qui — dentro l'installazione, accanto al driver a cui
   *  si riferisce — e non in `payment.costi`: è denaro che riguarda QUESTA posa e
   *  questa persona, e tenerlo attaccato al driver evita un importo orfano su una
   *  pratica a cui il driver è stato tolto.
   *  ⚠️ Come `payment.costi.costoTrasferta`, kpi-netto.ts non lo sottrae ANCORA:
   *  è dichiarato e non ancora contato, che è l'errore meno grave dei due. */
  compensoDriver?: number;
  // Checklist materiali personalizzata per lead (sovrascrive default per tipo)
  checklist?: ChecklistItem[];
  /** ── LA POSA È STATA FATTA (giorno, in ISO) ──────────────────────────────
   *  ⚠️ CAMPO NUOVO, E RISOLVE UNA COLLISIONE CHE PRIMA NON ESISTEVA.
   *  Fino a ieri «la posa è avvenuta» non aveva un campo suo: lo diceva lo
   *  stato "venduto", perché quello stato si assegnava a mano dal modulo
   *  installazioni quando il tecnico aveva finito. Da quando la vendita si
   *  chiude con una delle tre `posa_*`, quel trucco si rompe in silenzio e in
   *  tutti e due i versi:
   *   · una vendita appena chiusa risulterebbe GIÀ INSTALLATA se qualcuno
   *     leggesse ancora lo stato — il cliente non ha visto nessuno;
   *   · e il pulsante «Completata», riscrivendo "venduto", CANCELLEREBBE il
   *     modo di consegna appena registrato, buttando via l'unica riga che dice
   *     se il pacco va spedito o se il cliente viene da noi.
   *  Due domande diverse vogliono due campi diversi: lo STATO dice se ha
   *  comprato, questo dice se l'impianto è addosso. Lo scrivono
   *  segnaCompletata() e incassaSaldo() in crm/InstallationScheduleDialog.tsx;
   *  si legge SEMPRE da `posaFatta()` qui sotto, mai a mano.
   *  Facoltativo di proposito: in archivio non c'è su nessuna scheda, ed è la
   *  ragione per cui `posaFatta` tiene la vecchia regola come ripiego. */
  completataIl?: string;
  /** ── QUESTA POSA VA IN CIMA ALL'ELENCO ──────────────────────────────────
   *  true = qualcuno ha deciso a mano che questa pratica non aspetta il suo
   *  turno. È l'unico modo di scavalcare l'ordine per data delle installazioni,
   *  ed è una DECISIONE DI UNA PERSONA: non si accende da sola, non la accende
   *  nessun calcolo, e si spegne con lo stesso gesto con cui si è accesa
   *  (crm/priorita.ts, `useAzioniPriorita`).
   *  ⚠️ NON È UNO STATO DELLA PRATICA e non tocca né i conti né l'agenda:
   *  sposta soltanto la riga in cima. Se un domani volesse dire "urgente" per
   *  qualche calcolo, la prima cosa che succederebbe è che nessuno se la
   *  sentirebbe più di toglierla.
   *  Assente = nel suo turno, che è il caso normale. */
  priorita?: boolean;
  /** ── IL GIORNO CHE VORREBBE IL CLIENTE (AAAA-MM-GG) ─────────────────────
   *  ⚠️⚠️ NON È `dataInstallazione`, E I DUE CAMPI NON SI FONDONO MAI.
   *  Questo è un DESIDERIO detto al telefono («mi servirebbe per il 20, ho il
   *  matrimonio di mia figlia»): non occupa nessuna agenda, non blocca nessun
   *  installatore, non compare in nessun conteggio del giorno e nessuno ci si
   *  presenta. `dataInstallazione` invece è un APPUNTAMENTO con una persona, e
   *  lo scrive solo «Programma installazione» dopo aver guardato chi è libero.
   *  Scriverlo nell'altro campo — o farlo diventare l'altro campo da solo —
   *  vorrebbe dire riempire l'agenda di appuntamenti che nessuno ha preso, e
   *  scoprirlo il giorno in cui un cliente aspetta a casa un tecnico che non
   *  sa di doverci andare. Per questo a schermo si legge sempre con il verbo:
   *  «vorrebbe il 20 gen», mai «20 gen» e basta.
   *  ⚠️ NON SI CANCELLA quando la priorità si toglie: quello che il cliente ha
   *  chiesto resta detto, e rimetterla in cima non deve costare una seconda
   *  telefonata per ricordarsi la data. Si smette solo di mostrarlo sulla riga
   *  — fuori dalla priorità è un'informazione, non una scadenza.
   *  ⚠️ E ALLORA SI RILEGGE DA UN POSTO SOLO: la finestrella del pulsante ↑
   *  della riga (`TastoPriorita`), che riapre sempre con dentro la data
   *  salvata. La scheda del cliente NON la mostra, di proposito — una data
   *  chiesta tre mesi fa, stampata fra i dati della pratica, si legge come una
   *  scadenza che nessuno ha promesso. Chi un domani la volesse anche altrove
   *  aggiunga un lettore, ma sempre col verbo davanti («vorrebbe il…»).
   *  Facoltativo: una posa può stare in cima senza nessuna data desiderata
   *  («fatemela il prima possibile»), ed è il caso più comune. */
  dataDesiderata?: string;
  /** ── QUANTO COSTERÀ LA COPERTURA, SU QUESTA PRATICA ─────────────────────
   *  L'importo che il cliente pagherà per un intervento — rigenerazione o
   *  sostituzione — dentro la finestra di copertura. Finisce sul riepilogo di
   *  consegna che si consegna insieme all'impianto (crm/ricevuta).
   *
   *  ⚠️ SI SALVA SULLA PRATICA E NON SI RILEGGE DAL LISTINO OGNI VOLTA, ed è il
   *   motivo per cui questo campo esiste: il documento si ristampa — si perde,
   *   lo chiede il cliente sei mesi dopo — e un listino nel frattempo ritoccato
   *   farebbe uscire una seconda copia con dentro una cifra diversa dalla prima.
   *   Due fogli con lo stesso intestatario e due prezzi è il genere di cosa che
   *   si scopre con il cliente che li ha tutti e due in mano.
   *  Assente = non è mai stato stampato niente per questa pratica: la finestra
   *  propone il prezzo di listino di oggi (MAINTENANCE.price in shop/quote-menu)
   *  e lo scrive qui appena si conferma.
   *  ⚠️ I MESI NON STANNO QUI: sono una regola commerciale uguale per tutti e
   *   vivono in un posto solo (MAINTENANCE.everyMonths). Copiarli su ogni
   *   pratica vorrebbe dire che cambiarli non cambia niente per chi è già in
   *   archivio, senza che nessuno se ne accorga. */
  coperturaImporto?: number;
  /** ── L'ID DELL'IMPIANTO: A COSA È ATTACCATA LA GARANZIA ─────────────────
   *  Il certificato di copertura non copre «un cliente», copre UN impianto, e
   *  questo è il codice con cui quell'impianto si riconosce quando il cliente
   *  torna mesi dopo dicendo che si è rovinato.
   *
   *  ⚠️ SI CONGELA ALLA PRIMA STAMPA E NON CAMBIA PIÙ, ed è tutto il senso del
   *   campo. Normalmente è il ref del preventivo (`data.quoteRef`), ma quel ref
   *   CAMBIA: basta rifare il preventivo con uno sconto e ne nasce un altro
   *   (api.presenter.quote-revise). Se il certificato lo rileggesse ogni volta,
   *   la copia che il cliente ha in mano e quella che ristampiamo noi
   *   porterebbero due codici diversi — cioè la garanzia non sarebbe più
   *   attaccata a niente di verificabile. Scritto qui una volta, resta.
   *
   *  Assente = non è mai stato stampato un certificato. Se in quel momento non
   *  c'è nemmeno un preventivo, se ne conia uno (`nuovoIdImpianto` in
   *  crm/ricevuta): un impianto consegnato ha diritto al suo codice anche
   *  quando la pratica è nata senza passare dal preventivo. */
  idImpianto?: string;
  /** ── COME ARRIVA AL CLIENTE ─────────────────────────────────────────────
   *  Tre modi, e sono una scelta SOLA (non due interruttori che si possono
   *  accendere insieme):
   *   · "sede"       → si posa da noi: agenda, orario, tecnico;
   *   · "domicilio"  → si posa a casa del cliente: occupa un tecnico per delle
   *     ore e HA un'ora, quindi resta nell'agenda e nei conteggi del giorno,
   *     esattamente come una posa in sede — in più ha l'indirizzo e il costo
   *     del viaggio (che sta in payment.costi.costoTrasferta, perché è un
   *     costo, non un incasso);
   *   · "spedizione" → si imballa e parte: nessun tecnico, nessun orario,
   *     quindi fuori dall'agenda e dai conteggi.
   *
   *  ⚠️ `daSpedire` RESTA, e non è un doppione: le pratiche già salvate non
   *  hanno `modo`, e senza quel booleano diventerebbero tutte "in sede" — con i
   *  pacchi che ricompaiono in agenda. Si legge `modo` se c'è, altrimenti
   *  `daSpedire`; ogni scrittura li aggiorna INSIEME.
   *  Lo scrive useAzioniSpedizione() in crm/spedizione.ts. */
  spedizione?: {
    modo?: "sede" | "domicilio" | "spedizione";
    daSpedire?: boolean;
    /** dove va consegnata: vale sia per la spedizione sia per il domicilio */
    indirizzo?: string;
    spedito?: boolean;
    dataSpedizione?: string;
    tracking?: string;
  };
}

/* ── LA MANUTENZIONE ────────────────────────────────────────────────────────
 *  Quando la posa è fatta il cliente non ha finito: l'impianto si RIFISSA ogni
 *  due o quattro settimane, e da quel momento in poi torna per sempre. Fino a
 *  ieri quel ritorno non era scritto da nessuna parte — se lo ricordava chi
 *  aveva posato, e infatti se lo ricordava per i primi due clienti.
 *
 *  OGNI QUANTO, E CHI LO DECIDE
 *  La cadenza NON è stata inventata qui: sta già scritta in due punti del
 *  progetto, e dice due cose che sembrano in disaccordo e non lo sono —
 *  routes/slide.tsx («ogni due o quattro settimane si rifissa», quindici giorni
 *  per chi ha il sudore acido, trenta per gli altri) e la FAQ pubblica
 *  (components/landing/FaqAccordion.tsx: «circa una volta al mese»). Il numero
 *  quindi non è una proprietà del prodotto ma DELLA PERSONA, ed è per questo che
 *  `cadenzaGiorni` sta sul cliente e non sull'appuntamento: si decide una volta,
 *  la prima, e da lì in avanti vale per tutte le manutenzioni successive senza
 *  che nessuno debba ridirla ogni volta.
 *  ⚠️ E si scrive SOLO quando si sta fissando un CICLO. Un intervento singolo
 *   (`tipo: "singolo"`, qui sotto) non ne scrive nessuna e non ne cambia
 *   nessuna: è precisamente ciò che vuol dire «un ritorno e basta, senza
 *   impegnare il cliente». Se il cliente aveva già una cadenza, quella resta
 *   dov'era — un intervento fuori giro non riscrive il giro.
 *  ⚠️ NON confonderla con `MAINTENANCE` di shop/quote-menu.ts (450 €, due
 *   manutenzioni comprese oppure la sostituzione): quella è la RIGENERAZIONE
 *   dell'impianto, un
 *   servizio con un suo prezzo che si vende nel preventivo. Questa è il
 *   rifissaggio, che è un appuntamento e non si paga a parte. Mescolarle
 *   vorrebbe dire far comparire una cifra di 450 € su un appuntamento da
 *   quaranta minuti.
 *
 *  PERCHÉ DUE STATI E NON UNO
 *  «Promemoria» e «appuntamento» sembrano la stessa cosa e sono l'opposto:
 *   · "da_fissare" è solo una data ATTESA. Non ha un'ora, non ha una persona,
 *     non toglie niente a nessuna agenda: è una promessa che ci siamo fatti noi.
 *   · "fissata" ha giorno, ora e chi la esegue, quindi occupa tempo vero.
 *  Se esistesse il solo appuntamento, ogni cliente che non richiama si
 *  porterebbe dietro un posto in calendario per mesi — e a fine anno l'agenda
 *  sarebbe piena di gente che non verrà. Se esistesse il solo promemoria, chi ha
 *  il cliente davanti e potrebbe chiudere la cosa in dieci secondi dovrebbe
 *  richiamarlo il mese dopo per fare quello che poteva fare subito.
 *  "fatta" e "saltata" sono i due esiti, e sono scritti a mano: una manutenzione
 *  il cui giorno è passato e che nessuno ha ancora chiuso NON diventa "saltata"
 *  da sola — resta aperta e in ritardo, che è la verità («non lo sappiamo»),
 *  mentre «saltata» è un giudizio e lo dà una persona.
 *
 *  PERCHÉ UN ELENCO E NON UN CAMPO SOLO
 *  Perché la seconda manutenzione nasce dalla prima: segnare «fatta» crea il
 *  promemoria della successiva (vedi crm/manutenzione/azioni.ts). Con un campo
 *  solo, ogni ritorno cancellerebbe quello di prima e la domanda «quante ne ha
 *  saltate quest'anno» non avrebbe più risposta.
 *  ⚠️ CAMPI NUOVI, MAI OBBLIGATORI: in archivio non c'è una sola scheda che li
 *   abbia, e chi legge deve reggere l'assenza — si legge sempre dalle funzioni
 *   di crm/manutenzione/regole.ts, mai a mano.
 *  ⚠️ SOLO "fissata" TOGLIE TEMPO A QUALCUNO. booking-utils.ts conta le
 *   manutenzioni insieme a meeting, visite in sede e pose: un ritorno con
 *   giorno, ora e persona sparisce dagli orari offribili a chiunque altro, nel
 *   giorno come nel carico del mese. Un promemoria no, e non è una dimenticanza:
 *   non ha un'ora, e trattarlo come impegno vorrebbe dire tenere occupata
 *   un'agenda per un cliente che non ha confermato niente.
 *   ⚠️ E le persone che un ritorno impegna sono fino a TRE: chi lo esegue, chi
 *   lo affianca e chi va a prendere il cliente. Il margine è di ciascuno — mezz'ora
 *   per il manutentore, che in sede non va da nessuna parte; le due e le tre ore
 *   di sempre per chi affianca e per chi guida, perché il viaggio è loro. Il
 *   conto è tutto in `fasciaDelRitorno` (crm/booking-utils.ts). */
export type StatoManutenzione = "da_fissare" | "fissata" | "fatta" | "saltata";

/** Da dove nasce questo ritorno. Serve a leggere lo storico senza indovinare:
 *  «la prima dopo la posa», «quella che è nata dalla precedente», «l'ha messa
 *  qualcuno a mano». */
export type OrigineManutenzione = "posa" | "precedente" | "mano";

/** ── UN CICLO, OPPURE UN INTERVENTO E BASTA ────────────────────────────────
 *  Due risposte a due domande diverse, e per questo un campo e non un booleano
 *  chiamato «ripetuto»:
 *   · "ciclo"   → il cliente entra in un giro di ritorni. Si decide OGNI QUANTO
 *     torna (`cadenzaGiorni`, sul cliente), e quando questo ritorno viene
 *     segnato fatto il CRM mette da solo il promemoria del successivo. È il caso
 *     normale di chi ha appena preso l'impianto.
 *   · "singolo" → un intervento e basta. Nessuna cadenza scritta sulla scheda,
 *     e segnandolo fatto NON nasce niente dopo: il cliente non è stato impegnato
 *     a nulla. È il ritorno una tantum — un ritocco, una cortesia, un cliente
 *     che passa a farsi sistemare una cosa e non vuole un abbonamento.
 *  ⚠️ ASSENTE = "ciclo", e non è una svista: tutte le righe scritte prima che
 *   questa scelta esistesse sono nate dentro un ciclo — la procedura chiedeva la
 *   cadenza e basta — quindi il ripiego è l'unica lettura che non cambia il
 *   comportamento di una sola scheda d'archivio. Si legge sempre da `tipoDi()`
 *   in crm/manutenzione/regole.ts, mai a mano.
 *  ⚠️ NON confonderlo con lo STATO (promemoria / fissata / fatta / saltata):
 *   quello dice a che punto è QUESTO ritorno, questo dice se dopo ne viene un
 *   altro. Le due domande si incrociano tutte e quattro per due — esiste
 *   benissimo un intervento singolo di cui si è messo solo il promemoria. */
export type TipoManutenzione = "ciclo" | "singolo";

export interface AppuntamentoManutenzione {
  /** Chiave stabile: serve a React, ma soprattutto a ritrovare QUESTA riga
   *  dentro l'elenco quando la si segna fatta o la si sposta. Confrontare per
   *  data sarebbe bastato finché due manutenzioni non cadono nello stesso
   *  giorno — e cadono, appena una viene rifissata. */
  id: string;
  stato: StatoManutenzione;
  /** Il giorno, sempre pieno (YYYY-MM-DD): è la data ATTESA finché è un
   *  promemoria, la data FISSATA appena diventa un appuntamento. Un promemoria
   *  senza giorno non è un promemoria — è un pensiero, e non lo ricorda
   *  nessuno. */
  data: string;
  /** "15:30". Solo quando è fissata: è l'ora che la distingue dal promemoria. */
  ora?: string;
  /** Minuti. Assente = la durata predefinita di crm/manutenzione/regole.ts. */
  durata?: number;
  /** Chi la esegue: l'id di un consulente a cui è segnato il MESTIERE
   *  «manutentore» (si legge da `mestieriDi()` in crm/kpi-setter.ts). Solo
   *  quando è fissata, per la stessa ragione dell'ora.
   *  ⚠️ NON è per forza chi ha posato: la spunta del manutentore è sua e
   *  separata da quella dell'installatore, perché rifissare un impianto che c'è
   *  già e montarne uno nuovo sono due lavori. Chi ha posato resta però il
   *  valore di PARTENZA che la procedura propone: è la persona che il cliente
   *  conosce. */
  consulenteId?: string;
  /** ── CHI VA INSIEME A CHI ESEGUE IL RITORNO ─────────────────────────────
   *  L'id di un consulente a cui è segnato il mestiere «accompagnatore» — lo
   *  stesso elenco delle pose, perché è lo stesso mestiere e una seconda spunta
   *  «accompagnatore per le manutenzioni» sarebbe il secondo elenco di ruoli che
   *  questo CRM ha deciso di non avere. Assente o vuoto = ci pensa il
   *  manutentore da solo, che è il caso normale.
   *  ⚠️ Chi lo scrive occupa anche la sua agenda: booking-utils.ts gli blocca la
   *  fascia del ritorno più DUE ore prima e due dopo — le sue, non quelle del
   *  manutentore. Sceglierlo È la dichiarazione che qualcuno si muove. */
  accompagnatoreId?: string | null;
  /** ── CHI VA A PRENDERE IL CLIENTE ───────────────────────────────────────
   *  L'id di un consulente a cui è segnato il mestiere «driver», lo stesso
   *  elenco delle pose. Assente o vuoto = il cliente viene da sé, che è il caso
   *  normale della manutenzione (si fa in sede).
   *  ⚠️ Chi lo scrive si prende TRE ore di margine prima e tre dopo, come sulle
   *  pose: il viaggio è suo e non dell'intervento. E come sulle pose non esiste
   *  un booleano accanto — due campi per una domanda sola si contraddicono al
   *  primo salvataggio.
   *  ⚠️ Il compenso del driver (`installazione.compensoDriver`) NON si applica
   *  qui: quello è un costo della posa, e questo campo non lo tocca. */
  driverId?: string | null;
  /** Ciclo di ritorni o intervento singolo. Assente = "ciclo": vedi
   *  `TipoManutenzione` qui sopra per il perché del ripiego. */
  tipo?: TipoManutenzione;
  origine?: OrigineManutenzione;
  /** Note per chi la eseguirà: le legge chi apre la scheda del cliente. */
  note?: string;
  /** ISO del momento in cui è stata creata: serve solo a ordinare lo storico
   *  quando due righe hanno la stessa data. */
  creataIl?: string;
  /** Giorno in cui è stata davvero fatta. Può non coincidere con `data` — un
   *  cliente che si presenta due giorni dopo è normale — e distinguere le due
   *  è ciò che permette di calcolare la prossima dal ritorno VERO. */
  fattaIl?: string;
  /** Perché è saltata, se qualcuno l'ha scritto. */
  motivo?: string;
  /** ── QUANTO PAGA IL CLIENTE PER QUESTO RITORNO ─────────────────────────
   *  Euro, scritti quando si fissa il ritorno: il prezzo di una manutenzione
   *  non è sempre lo stesso — cambia con quello che c'è da rifare — quindi sta
   *  sull'appuntamento e non sulla scheda del cliente.
   *  ⚠️ ENTRA NEL TOTALE SPESO SOLO QUANDO IL RITORNO È STATO FATTO (vedi
   *   `totaleManutenzioni` in crm/acquisti.ts): un ritorno in programma è un
   *   incasso previsto, non speso, e sommarlo direbbe che il cliente ha già
   *   lasciato dei soldi che potrebbe non lasciare mai. */
  importo?: number;
}

export interface ManutenzioneInfo {
  /** Ogni quanti giorni torna QUESTO cliente. Assente = non l'ha ancora deciso
   *  nessuno, e vale il valore predefinito di crm/manutenzione/regole.ts. */
  cadenzaGiorni?: number;
  /** Tutte le manutenzioni del cliente, passate e future. Non ordinato per
   *  contratto: chi legge ordina (regole.ts lo fa una volta sola). */
  appuntamenti?: AppuntamentoManutenzione[];
}

// Checklist materiali default per tipo installazione
export const CHECKLIST_DEFAULT_BY_TYPE: Record<TipoInstallazione, string[]> = {
  da_impostare: [
    "Protesi cliente",
    "Adesivo / colla",
    "Forbici professionali",
    "Modulo firma consenso",
  ],
  taxi: [
    "Protesi cliente",
    "Adesivo waterproof",
    "Solvente",
    "Forbici professionali",
    "Pettine + spazzola",
    "Phon portatile",
    "Asciugamani",
    "Specchio portatile",
    "Borsa trasporto kit",
    "Modulo firma consenso",
    "POS portatile",
  ],
  indipendente: [
    "Protesi cliente",
    "Adesivo / colla",
    "Solvente",
    "Forbici professionali",
    "Pettine + spazzola",
    "Phon",
    "Asciugamani",
    "Specchio",
    "Modulo firma consenso",
  ],
};

// Qualifica dal funnel pubblico
export interface QualificaInfo {
  disagio?: number;
  painPoints?: string[];
  urgenza?: "si" | "valutando" | "subito" | "1mese" | "convince" | "2_3mesi" | "valuto";
}

/** ── LE RISPOSTE DEL MODULO, COME VOCI DELLA SCHEDA ───────────────────────
 *  Richiesta del committente: «in base alle domande dentro al lead, ci siano
 *  anche queste info, ma non nelle note, ma proprio come voce a sé stante».
 *  Prima finivano in fondo alle note, in fila: si leggevano una volta prima di
 *  telefonare e poi sparivano — non si potevano contare né filtrare.
 *  Gli id (non le frasi) perché su questi si conta: «quanti al Sud», «quanti
 *  da chiamare di sera». Le frasi, che cambiano a ogni modulo riscritto,
 *  stanno in `risposte` e servono a leggere, mai a decidere.
 *  Chi le riconosce: crm/modulo-lead.ts, in un punto solo. */
export interface RisposteModulo {
  /** Come vive il problema: `subito` | `valutando` | `informativo`. */
  urgenza?: string;
  /** Ci conosce: `segue` | `settore` | `nuovo`. */
  conoscenza?: string;
  /** Zona d'Italia: `nord` | `centro` | `sud` | `estero`. */
  zona?: string;
  /** Quando preferisce essere chiamato: `mattina` | `pranzo` | `pomeriggio` | `sera`. */
  quando?: string;
  /** Se il giorno e l'ora li ha scritti a mano invece di scegliere una fascia. */
  quandoTesto?: string;
  /** ── TUTTE LE RISPOSTE DEL QUESTIONARIO ───────────────────────────────
   *  Richiesta del committente: «sulla scheda lead ci siano tutte le risposte
   *  che danno nel questionario», e su queste si conta poi il tasso di
   *  conversione nei KPI.
   *  Ci sono dentro sia le quattro che sappiamo leggere (con `campo`
   *  valorizzato e la nostra domanda) sia quelle dei moduli che non
   *  conosciamo (senza `campo`, con la domanda come sta scritta nel file).
   *  ⚠️ La domanda di una risposta sconosciuta si scrive SOLO quando le
   *   intestazioni del file combaciano con i dati: vedi `paDomanda` e
   *   `intestazioniAffidabili`. Una domanda sbagliata stampata in una scheda
   *   si crede.
   *  ⚠️ Per contare si raggruppa su `domanda`+`risposta` così come sono: sono
   *   testo, non codici, ed è voluto — un modulo nuovo deve poter entrare nei
   *   conti senza che nessuno pubblichi niente. */
  risposte?: {
    domanda: string;
    risposta: string;
    campo?: string;
    /** ── LE PAROLE SUE, PER INTERO ────────────────────────────────────
     *  L'opzione com'è scritta nel modulo («è importante: sto valutando
     *  seriamente di prendere provvedimenti nel breve-medio termine.»),
     *  mentre `risposta` è il nome corto con cui la mostriamo.
     *  ⚠️ Serve perché accorciare è comodo ma è una nostra parafrasi: la
     *   frase che la persona ha scelto non si deve perdere, e chi vuole
     *   leggerla per intero deve poterlo fare senza riaprire il file. */
    testo?: string;
  }[];
}

// Tracking dal funnel pubblico
export interface TrackingInfo {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_id?: string;
  utm_content?: string;
  utm_term?: string;
  source?: "meta" | "tiktok" | "organic";
  fbp?: string;
  fbc?: string;
  fbclid?: string;
  ttclid?: string;
  event_id?: string;
  // Granular Meta ad attribution
  ad_id?: string;
  adset_id?: string;
  campaign_id?: string;
  ad_name?: string;
  /** ⚠️ `campaign_name` era GIÀ LETTO (crm/ads-financials.functions.ts) e non
   *   era dichiarato: un errore di battitura su quel nome sarebbe passato
   *   senza che nessuno dicesse niente, e la campagna sarebbe semplicemente
   *   sparita dai conti. `adset_name` e `form_name` arrivano dallo stesso file
   *   di Meta e prima si buttavano. */
  campaign_name?: string;
  adset_name?: string;
  form_name?: string;
  creative_name?: string;
  external_id?: string;
}

/** ── UNA RIGA DELLO STORICO ACQUISTI ──────────────────────────────────────
 *  Il dettaglio è FACOLTATIVO: nella maggior parte dei casi al titolare basta
 *  sapere "ha comprato due volte" e obbligarlo a compilare prodotto, data e
 *  importo per ottenere quel numero costerebbe più di quanto vale. La riga
 *  esiste solo quando qualcuno la crea davvero. Per questo ogni campo oltre al
 *  prodotto è opzionale: una riga incompleta è comunque un acquisto vero. */
export interface RigaAcquisto {
  /** Chiave stabile della riga. Serve a React quando si cancella una riga in
   *  mezzo all'elenco: con l'indice, le righe sotto scalerebbero e il testo che
   *  si sta scrivendo finirebbe nella riga sbagliata. */
  id: string;
  prodotto: string;
  /** ISO YYYY-MM-DD */
  data?: string;
  importo?: number;
}

/** ── COM'È ANDATA A FINIRE, IN CIFRE ──────────────────────────────────────
 *  Quello che si scrive nel momento in cui si sceglie una delle tre chiusure
 *  vinte: quanto ha lasciato, quanto vale in tutto la pratica, e le due righe
 *  di contorno che non stanno in nessun altro campo.
 *  LO SCRIVE il dialogo che registra la chiusura (crm/QuickStatusDialog.tsx,
 *  ramo dei pagamenti). LO LEGGONO i KPI (crm/kpi-calcoli.ts, ricavoLordo e
 *  accontoDi) e la scheda del lead (crm/LeadDialog.tsx).
 *
 *  ⚠️ NON È LA CASSA, È IL VERBALE DELLA CHIUSURA. La verità sui soldi resta
 *   `payment`: `payment.accontoPagato` è il campo che fa scattare lo stato
 *   "acconto" e che ricalcola il saldo (vedi applyAutoStatus), e
 *   `payment.prezzoFinaleVendita` è quello che i KPI guardano per primo. Chi
 *   riempie `chiusura` DEVE riscrivere gli stessi due importi anche là, nello
 *   stesso salvataggio: altrimenti si ottiene una pratica «vinta» con il saldo
 *   fermo al totale e nessun acconto in cassa, e il buco si scopre alla
 *   consegna, davanti al cliente. */
export interface ChiusuraInfo {
  /** Quanto ha lasciato adesso, in euro. Specchio di payment.accontoPagato. */
  accontoIncassato?: number;
  /** Quanto vale la pratica in tutto: è l'importo del preventivo che si sta
   *  chiudendo, non il listino. Specchio di payment.prezzoFinaleVendita. */
  totalePreventivo?: number;
  /** Righe libere sull'accordo: la rata promessa a voce, lo sconto concesso,
   *  il "paga il resto alla consegna". Non hanno un campo loro e senza questo
   *  finivano nelle note generali, dove si perdono. */
  note?: string;
}

/** ── L'IMPIANTO CHE NON È UNO DEI SOLITI ──────────────────────────────────
 *  Serve a chi ordina e a chi posa: un impianto su misura ha tempi diversi e
 *  non si può sostituire al volo se qualcosa non torna.
 *  LO SCRIVE la scheda del lead (crm/LeadDialog.tsx, sezione prodotto).
 *  LO LEGGE la scheda della posa (crm/InstallationScheduleDialog.tsx).
 *
 *  Non sostituisce `dettagliImpianto`, che resta la descrizione tecnica del
 *  prodotto (base, densità, colore): qui c'è solo la risposta a «è standard o
 *  è fatto per lui?» e, se non è standard, che cosa ha di particolare. */
export interface ImpiantoSuMisura {
  /** vero = fatto su misura per questo cliente */
  attivo?: boolean;
  /** che cosa ha di diverso: attaccatura, forma, misura presa a mano… */
  note?: string;
}

/** ── I SOLDI CHE MANCANO ANCORA ───────────────────────────────────────────
 *  Il caso di tutti i giorni: a lavoro iniziato salta fuori che serve
 *  qualcosa in più — una lavorazione, una misura fuori standard, un secondo
 *  impianto. Va chiesto al cliente, e la domanda più pericolosa è la terza:
 *  GLIEL'ABBIAMO GIÀ DETTO? Chiederglielo due volte fa una brutta figura,
 *  non chiederglielo affatto fa perdere quei soldi alla consegna.
 *  LO SCRIVE la scheda della posa (crm/InstallationScheduleDialog.tsx).
 *  LO LEGGONO la scheda del lead (crm/LeadDialog.tsx) e le pagine delle
 *  installazioni (routes/CRM.installazioni.*.tsx), che devono poterlo mostrare
 *  prima che il tecnico esca.
 *
 *  ⚠️ NON ENTRA NEI KPI e non si somma al saldo: finché non è incassato è una
 *   richiesta, non un ricavo. Un importo solo sperato contato come fatturato
 *   gonfia due numeri in una volta (la cassa e il margine). Quando viene
 *   davvero incassato si scrive dove si scrivono gli incassi, in `payment`. */
export interface ExtraDaChiedere {
  /** vero = c'è da chiedere altro denaro */
  serve?: boolean;
  /** quanto, in euro */
  importo?: number;
  /** vero = il cliente lo sa già; falso o assente = va ancora detto */
  comunicatoAlCliente?: boolean;
}

/** ── UNA FOTO O UN VIDEO DEL CLIENTE ──────────────────────────────────────
 *  Le foto della testa prima e dopo, il video girato a fine posa: il materiale
 *  che il consulente riguarda in scheda e mostra al cliente successivo.
 *
 *  ⚠️ SONO DATI PERSONALI, NON IMMAGINI QUALSIASI. Teste, prima e dopo, spesso
 *   volti riconoscibili. Oggi vivono nello spazio file PUBBLICO del centro:
 *   il bucket è 'clienti-media', creato con public:true da
 *   routes/api.crm.media-upload.ts. ⚠️ NON è 'presenter-videos', quello delle
 *   consulenze registrate, ed è separato APPOSTA: il giorno in cui il
 *   committente sceglie di chiuderlo, si cambia un'impostazione su questo
 *   bucket senza spegnere i link delle consulenze già mandate ai clienti.
 *   Finché resta pubblico, chi conosce l'indirizzo apre il file senza nessuna
 *   credenziale, per sempre — e togliere la voce da questo elenco NON cancella
 *   il file. Da qui due conseguenze scritte nel codice e non solo nei commenti:
 *    · `url` deve puntare a un percorso SORTEGGIATO col generatore
 *      crittografico e con la sola estensione (mai il nome del cliente, mai
 *      l'id del lead, mai un progressivo): lo produce
 *      routes/api.crm.media-upload.ts, che è l'unica porta da cui questi file
 *      entrano;
 *    · la cancellazione vera del file è una decisione ancora aperta del
 *      committente, ed è descritta in crm/portfolio/dati.ts (`senzaVoce`).
 *
 *  LO SCRIVE  crm/portfolio/dati.ts, che è l'unico posto in cui queste voci si
 *             compongono e si riscrivono.
 *  LO LEGGONO il pulsante-anteprima sulle righe delle installazioni, la
 *             finestra del carosello e la sezione «Foto e video» della scheda
 *             cliente. */
export interface MediaCliente {
  /** Chiave stabile della voce. NON è l'url, ed è una scelta: se un domani si
   *  chiudesse il bucket e si passasse agli indirizzi firmati a scadenza, l'url
   *  cambierebbe e una principale puntata per url si perderebbe in silenzio su
   *  tutte le schede. Serve anche a React quando si toglie una voce in mezzo
   *  all'elenco. */
  id: string;
  /** L'indirizzo del file nello spazio pubblico. */
  url: string;
  /** "video" | "image". È la stessa parola di media/galleria.ts, così da una
   *  voce si ottiene una VoceGalleria per il carosello senza tradurre niente. */
  kind: TipoMedia;
  /** Il nome che il consulente legge in elenco. ⚠️ NON si mostra mai al
   *  cliente: è l'appunto interno, e molto spesso è il nome di una persona. */
  nome?: string;
  /** Quando è entrata (ISO). */
  caricatoIl: string;
  /** Il nome del consulente collegato col PIN, quando c'è. Vuoto se si è
   *  entrati con l'account padrone. Serve a LEGGERE («questa l'ha messa
   *  Marco»), MAI a decidere chi può togliere una voce — stessa regola di
   *  `saltatoDa`. */
  caricatoDa?: string;
}

/** ── IL PORTAFOGLIO DI FOTO E VIDEO DEL LEAD ──────────────────────────────
 *  L'elenco ORDINATO dei media del cliente, più quale di quelle fa da
 *  principale (l'anteprima sul pulsante che apre il carosello).
 *
 *  ⚠️ LA PRINCIPALE È UN CAMPO SOLO, NON UN INTERRUTTORE PER VOCE. Un
 *   `principale?: boolean` su ogni riga permette due voci accese insieme, e
 *   nessuno dei posti che leggono saprebbe quale delle due mostrare: è lo
 *   stesso errore che crm/spedizione.ts esiste per non avere. Qui la domanda
 *   «quale si vede sul pulsante» ha una casella sola, quindi sceglierne
 *   un'altra spegne la precedente da sé.
 *
 *  ⚠️ SI RISCRIVE SEMPRE INTERO. `updateLead` fa un merge SUPERFICIALE
 *   (CRMContext: `{ ...current.data, ...patch }`), quindi scrivere un pezzo
 *   solo di questo oggetto cancella il resto. Le funzioni di
 *   crm/portfolio/dati.ts restituiscono sempre l'oggetto completo, ed è per
 *   questo che esistono. */
export interface MediaClienteInfo {
  /** L'ordine è quello in cui si scorrono nel carosello. Il tetto è MAX_VOCI
   *  (60) di media/galleria.ts, lo stesso di una raccolta pubblica: così un
   *  portafoglio non può contenere più di quanto un link riesca a portare. */
  voci: MediaCliente[];
  /** L'id della voce da mostrare sul pulsante.
   *  ⚠️ Non è mai un video: la sua anteprima è il primo fotogramma, che su un
   *   quadratino di 28 pixel è quasi sempre nero, e un pulsante nero non dice
   *   che dietro c'è qualcosa. Un fermo immagine non lo abbiamo (nessuno lo
   *   genera, vedi conPrimoFotogramma in media/galleria.ts).
   *  Se punta a una voce che non c'è più si ripiega sulla prima FOTO: la regola
   *  sta in un posto solo, `principaleDi` in crm/portfolio/dati.ts. */
  copertinaId?: string;
  /** Ultimo cambiamento (ISO): serve a dirlo in scheda, non a ordinare. */
  aggiornatoIl?: string;
}

/** ── UNA PERSONA CHE TORNA IN UNA LISTA ───────────────────────────────────
 *  Il committente carica liste che si sovrappongono: la stessa persona
 *  ricompare, e la domanda che si fa è sempre la stessa — «questa l'abbiamo già
 *  lavorata: la lascio dov'è o la rimetto in circolo?».
 *  ⚠️ NON è un doppione da fondere: la scheda in archivio resta UNA e comanda
 *   lei. Qui si scrive soltanto che è successo, quante volte, e se qualcuno ha
 *   già deciso. Il perché per esteso sta in crm/importa/ricarico.ts. */
export interface RicaricoLead {
  /** Quante volte è ricomparsa in una lista. Non riparte mai da capo. */
  volte: number;
  /** L'ultima volta (ISO). */
  ultimo: string;
  /** Il nome del file che l'ha riportata a galla l'ultima volta. */
  lista?: string;
  /** Aspetta una decisione: finché è vero sta in cima ai «Lead importati».
   *  Assente = deciso (o mai chiesto): vedi `patchConferma`. */
  daDecidere?: boolean;
  /** Lo stato in cui era quando è ricomparsa: serve a raccontarlo dopo. */
  statoAllora?: LeadStatus;
  /** Quando è stata rimessa fra i «Da contattare» con lo stato azzerato. */
  rimessoIl?: string;
  /** ── ⚠️ «VEDI DOPO»: LA DECISIONE È RIMANDATA, NON PRESA ───────────────
   *  Richiesta del committente: oltre a «conferma» e «rimettilo fra i da
   *  contattare» serviva una terza via — metterlo da parte e decidere con
   *  calma — più un posto dove ritrovarli tutti.
   *  Quando c'è questa data la scheda NON sta più in cima alla coda delle
   *  telefonate (non interrompe più il giro) ma `daDecidere` resta vero: la
   *  domanda è ancora aperta, e si vede nella linguetta «Vedi dopo».
   *  ⚠️ Le due sono una coppia: `daDecidere` senza questa data = «decidi
   *   adesso», con la data = «decidi quando vuoi». Le due decisioni vere
   *   (conferma, rimetti) cancellano entrambe. */
  rimandatoIl?: string;
  /** Chi ha premuto «Vedi dopo»: in postazione ci sono più persone, e chi
   *  trova la scheda il giorno dopo deve sapere a chi chiedere. */
  rimandatoDa?: string;
  /** ── ⚠️ GLI HO SCRITTO SU WHATSAPP, ASPETTO CHE RISPONDA ──────────────
   *  Richiesta del committente: «quando clicco contatta su WhatsApp ai lead
   *  duplicati importati, fai che si spostano dentro contattati su WhatsApp».
   *  Quando c'è questa data la decisione NON è presa — `daDecidere` resta vero
   *  — ma la palla è dall'altra parte: si aspetta una risposta, e la scheda
   *  esce dalla cima della coda per finire nella linguetta «Scritti su
   *  WhatsApp». È la terza destinazione della stessa domanda, dopo «adesso» e
   *  «vedi dopo».
   *  ⚠️ Non è uno STATO del lead e non lo tocca: lo stato racconta la
   *   trattativa, questo racconta che cosa abbiamo fatto con QUESTO duplicato.
   *   Scriverlo nello stato vorrebbe dire perdere «appuntamento fissato» o
   *   «cliente assente» — cioè proprio l'informazione che rende utile il
   *   messaggio che gli si è appena mandato. */
  whatsappIl?: string;
  /** Chi ha premuto: in postazione ci sono più persone. */
  whatsappDa?: string;
  /** ── QUANTE VOLTE GLI ABBIAMO SCRITTO ──────────────────────────────────
   *  `whatsappIl` è l'ULTIMA volta — si sovrascrive, apposta, perché è quella
   *  che dice da quanto si aspetta. Ma così una persona a cui si è scritto tre
   *  volte senza mai una risposta è identica, nell'elenco, a una scritta
   *  stamattina: si continua a riscrivere a chi non risponde mai e si smette
   *  di capire quando è il momento di chiudere. Questo è il conto, e non torna
   *  mai indietro.
   *  ⚠️ Assente = una volta sola (è il caso di tutte le schede scritte prima
   *   che questo campo esistesse: non si inventa un conto che non c'era). */
  whatsappVolte?: number;
  /** ── ⚠️ IL MESSAGGIO È PARTITO DAVVERO? ───────────────────────────────
   *  Richiesta del committente: «quando clicco contatta su WhatsApp spostalo
   *  su contattati su WhatsApp, e lì posso cliccare un check se è stato
   *  contattato oppure una X se non ho inviato il messaggio».
   *  Premere il tasto apre soltanto WhatsApp: in mezzo c'è una persona che può
   *  ripensarci, sbagliare chat o non trovare il numero. Perciò la scheda si
   *  sposta SUBITO — il lavoro fatto si vede — ma resta in attesa di una
   *  conferma, e la conferma si dà da lì con due tasti.
   *  ⚠️ LA X NON SCRIVE «CONTATTATO NO»: cancella `whatsappIl`, cioè riporta la
   *   scheda in coda come se il messaggio non fosse mai partito — che è la
   *   verità. Resta solo questa data, per raccontarlo nella storia.
   *  ⚠️ Assente con `whatsappIl` presente = «mandato, ma non me l'ha ancora
   *   confermato nessuno». È uno stato vero e si vede: non si inventa un «sì». */
  whatsappConfermatoIl?: string;
  /** Chi ha confermato con il check. */
  whatsappConfermatoDa?: string;
  /** Quando qualcuno ha detto «no, non l'ho mandato» (la X). */
  whatsappAnnullatoIl?: string;
}

export interface LeadData {
  // anagrafica
  nome: string;
  cognome: string;
  telefono: string;
  email?: string;
  citta?: string;
  fonte?: LeadFonte;
  piattaformaAds?: PiattaformaAds;
  // assegnazione
  consulenteId?: string | null;
  stato: LeadStatus;
  /** ── LO STATO DI PRIMA, PER TORNARE INDIETRO ─────────────────────────────
   *  Lo scrive CRMContext.updateLead a ogni cambio, ed è l'unico punto da cui
   *  passano tutte le modifiche. Serve al tasto "torna indietro" della pagina
   *  Oggi: segnare "Cliente assente" al posto di "Da riprogrammare" è l'errore
   *  che si fa col telefono in mano, e senza questo campo l'unico rimedio è
   *  ricordarsi a memoria dove stava.
   *  Un solo passo, non una pila: chi sbaglia se ne accorge subito. */
  statoPrecedente?: LeadStatus;
  statoPrecedenteIl?: string;
  /** ── CHI HA MESSO LO STATO IN CUI SI TROVA ADESSO ───────────────────────
   *  L'id del consulente collegato quando lo stato è cambiato. Lo scrive
   *  `updateLead` (crm/CRMContext) insieme ai due campi qui sopra, nell'unico
   *  punto da cui passano tutte le modifiche.
   *  ⚠️ NON È `consulenteId`, ed è la ragione per cui serve: quello dice chi
   *   FARÀ la consulenza, questo chi l'ha FISSATA. Sono la stessa persona solo
   *   quando un consulente si prende un appuntamento da sé; quando è un setter
   *   a fissarlo sono due persone diverse, e senza questo campo il setter non
   *   ha nessun modo di ritrovare gli appuntamenti che ha preso lui — che è
   *   esattamente quello che gli serve per correggerne uno.
   *  ⚠️ Assente sulle schede toccate prima che questo campo esistesse: si
   *   legge come «non si sa», mai come «nessuno». */
  statoDa?: string;
  /** ── CHI HA PRESO QUESTO APPUNTAMENTO ────────────────────────────────────
   *  Segnalazione del committente: «il setter dopo che fissa le consulenze non
   *  può più vedere la lista di quello che ha fissato».
   *  ⚠️ NON È `statoDa`, ed è esattamente il difetto: `statoDa` dice chi ha
   *   toccato lo stato PER ULTIMO, quindi passa al consulente appena lui segna
   *   com'è andata — e la consulenza smette di risultare del setter che l'ha
   *   presa. Questo si scrive UNA VOLTA SOLA, quando la scheda entra in uno
   *   stato di appuntamento, e nessun esito successivo lo tocca.
   *  ⚠️ E NON È `consulenteId`, che dice chi la FARÀ.
   *  La regola sta in crm/chi-ha-fissato, e si prova senza browser. */
  fissatoDa?: string;
  /** ISO di quando è stata presa (non di quando si terrà). */
  fissatoIl?: string;
  highlighted?: boolean;
  createdAt: string; // ISO — data di acquisizione del lead (custom-impostabile)
  // ISO — settato automaticamente alla prima transizione in una chiusura.
  // Usato per attribuire le conversioni alla data REALE di chiusura (non di ingresso).
  // ⚠️ Chi lo scrive (crm/CRMContext.tsx, updateLead) riconosce la chiusura da un
  // elenco di stati scritto a mano lì dentro: da oggi quell'elenco deve
  // comprendere anche le tre chiusure vinte, altrimenti la data di conversione
  // non viene più segnata da nessuna parte e le vendite tornano ad attribuirsi
  // al giorno in cui è arrivato il numero di telefono.
  convertedAt?: string;
  /** ── L'ACQUISTO È GIÀ STATO ANNUNCIATO ALLE PIATTAFORME ─────────────────
   *  ISO, scritto la prima e unica volta che parte il Purchase verso Meta.
   *
   *  ⚠️ SENZA QUESTA RIGA UNA VENDITA SI POTEVA CONTARE DUE VOLTE, E IL CONTO
   *   ERA IN EURO. L'invio scattava «quando prima non era vinto e adesso sì»,
   *   che sembra la domanda giusta e non lo è: una vendita riaperta per
   *   correggere un importo, o rimessa in valutazione e richiusa il giorno
   *   dopo, ripassa da quella soglia e faceva partire un SECONDO acquisto con
   *   lo stesso valore. Meta li sommava, il ROAS della campagna saliva senza
   *   che fosse entrato un euro in più, e su quel numero si decide quanto
   *   spendere il mese dopo. Nemmeno la deduplica di Meta poteva salvarci:
   *   l'identificativo dell'evento era casuale a ogni invio (vedi
   *   `buildCrmEventId`), quindi i due eventi le arrivavano come due acquisti
   *   diversi di due persone diverse.
   *
   *  Un lead vinto due volte resta UN acquisto: questa data non si riscrive.
   *  Chi la legge: crm/CRMContext.tsx, updateLead. */
  adsPurchaseIl?: string;
  // meeting
  dataMeeting?: string;
  oraMeeting?: string;
  durataMeeting?: number;
  linkMeeting?: string;
  // follow-up
  dataRicontatto?: string;
  oraRicontatto?: string;
  /** ── QUANDO HA DETTO «VI RICONTATTO IO» ──────────────────────────────────
   *  ISO, scritto da solo ogni volta che si mette lo stato «Ci ricontatta lui»
   *  (crm/CRMContext, updateLead): è il giorno in cui l'ha detto, e non lo
   *  chiede a nessuno — è oggi per definizione.
   *  ⚠️ NON È `dataRicontatto`, e servono tutte e due: quella è il giorno
   *   ENTRO cui ha detto che si farà vivo, questa è il giorno in cui l'ha
   *   detto. Senza la seconda, una promessa fatta a marzo e una fatta ieri si
   *   leggono uguali — e sono due cose molto diverse da avere in mano quando
   *   lo si richiama.
   *  ⚠️ SI RISCRIVE ogni volta che lo stato viene rimesso: se lo ripete a
   *   distanza di un mese, vale l'ultima volta che l'ha detto. */
  ciRicontattaDettoIl?: string;
  dataVieneInSede?: string;
  oraVieneInSede?: string;
  durataVieneInSede?: number;
  accontoVieneInSede?: boolean;
  /** ── IL PREVENTIVO DI QUESTA SCHEDA ──────────────────────────────────────
   *  Il codice del preventivo costruito durante la consulenza (per esempio
   *  "ID8271X"). LO SCRIVE la rotta che tiene allineata la scheda con il
   *  presentatore (routes/api.crm.lead-sync.ts); LO LEGGE la finestra della
   *  chiusura (crm/ChiusuraDialog.tsx), che da lì recupera il totale vero da
   *  proporre come importo invece di farlo riscrivere a memoria.
   *  ⚠️ Era già SCRITTO e già LETTO, e non era dichiarato qui: chi lo leggeva
   *   doveva farlo con un cast locale, cioè senza nessuna rete — un errore di
   *   battitura sul nome del campo sarebbe passato senza che il compilatore
   *   dicesse niente, e il preventivo semplicemente non si sarebbe più trovato.
   *  Il confronto con l'elenco dei preventivi va fatto ESATTO: la ricerca là
   *  è per somiglianza, e prendere la prima riga vuol dire ogni tanto incassare
   *  il preventivo di un altro cliente. */
  quoteRef?: string;
  /** ── LE FATTURE EMESSE A QUESTO CLIENTE ────────────────────────────────
   *  Solo i numeri («2026-0007»): il documento intero vive in archivio (vedi
   *  crm/fatture/archivio.ts), e ricopiarlo qui vorrebbe dire due copie dello
   *  stesso importo che possono divergere — su una fattura è esattamente ciò
   *  che non deve succedere.
   *  ⚠️ È un elenco e non un campo solo: a un cliente si emettono un acconto e
   *   poi un saldo, e a volte una terza per una manutenzione. */
  fatture?: string[];
  // note
  note?: string;
  /** ── LE NOTE DOPO LA CONSULENZA ────────────────────────────────────────
   *  SONO QUESTE, non serve un campo nuovo: `notePostCall` esiste da sempre,
   *  ha già il suo permesso dedicato (canAddPostCallNotes) e le schede vecchie
   *  ne sono piene. Chi cerca "note post consulenza" scriva qui.
   *  LE SCRIVONO la scheda del lead (crm/LeadDialog.tsx) e il dialogo di esito
   *  (crm/QuickStatusDialog.tsx); LE LEGGE chiunque riapra la scheda.
   *  ⚠️ Non confonderle con `chiusura.note`, che riguardano l'ACCORDO
   *   economico: queste dicono com'è andata la consulenza. */
  notePostCall?: string;
  // prodotto
  codiceColore?: string;
  dettagliImpianto?: string;
  videoColoreSent?: boolean;
  /** Impianto fatto su misura: sì/no e che cosa ha di particolare.
   *  Chi scrive e chi legge: vedi ImpiantoSuMisura. */
  suMisura?: ImpiantoSuMisura;
  // pagamento + installazione + ordine
  payment?: PaymentInfo;
  /** Il verbale della chiusura vinta: acconto, totale del preventivo, note.
   *  Chi scrive e chi legge — e perché va rispecchiato in `payment` — è scritto
   *  su ChiusuraInfo. */
  chiusura?: ChiusuraInfo;
  /** Soldi ancora da chiedere al cliente: quanto, e se gliel'abbiamo già detto.
   *  Chi scrive e chi legge: vedi ExtraDaChiedere. */
  extraDaChiedere?: ExtraDaChiedere;
  installazione?: InstallazioneInfo;
  /** Foto e video del cliente, e quale di quelle fa da principale. Chi scrive,
   *  chi legge, e perché lo spazio in cui i file vivono è pubblico: è tutto
   *  scritto su MediaClienteInfo.
   *  ⚠️ Sta ACCANTO all'installazione e non dentro, ed è voluto: l'impianto lo
   *   si fotografa alla posa, ma anche al controllo dopo un mese e alla
   *   manutenzione dell'anno dopo. Sono foto DEL CLIENTE, non di quel singolo
   *   intervento, e infilarle dentro `installazione` le avrebbe legate a un
   *   fatto che accade una volta sola. */
  mediaCliente?: MediaClienteInfo;
  /** I ritorni del cliente dopo la posa: cadenza e appuntamenti.
   *  Sta ACCANTO all'installazione e non dentro, ed è voluto: l'installazione
   *  è un fatto che succede una volta e poi si chiude, la manutenzione è una
   *  cosa che continua per anni e sopravvive a quella posa (un impianto
   *  rigenerato o rifatto non è una posa nuova, ma il cliente torna lo stesso).
   *  Chi scrive e chi legge: crm/manutenzione/. */
  manutenzione?: ManutenzioneInfo;
  statoOrdine?: StatoOrdine;
  // qualifica + tracking dal funnel
  qualifica?: QualificaInfo;
  tracking?: TrackingInfo;
  /** Le risposte date nel modulo dell'inserzione, come voci e non come note.
   *  Vedi RisposteModulo, e crm/modulo-lead.ts per chi le riconosce. */
  modulo?: RisposteModulo;
  // origine pubblica (id del public_lead se importato)
  publicLeadId?: string;
  // ── LAVORAZIONE IN CHAT ────────────────────────────────────────────────
  //  Un lead può restare "in gestione" per giorni, con i suoi appunti e
  //  il momento in cui è stata presa in carico: l'archivio li porta con sé.
  inGestione?: boolean;
  dataGestione?: string;
  oraGestione?: string;
  noteGestione?: string;
  /** età del cliente: serve al preventivo (attaccatura e densità si decidono
   *  anche sull'età anagrafica) e arriva dal modulo pubblico. */
  eta?: number | string;
  /** ── I DATI ANAGRAFICI, TUTTI FACOLTATIVI ────────────────────────────────
   *  Servono a fatturare, e prima non stavano da nessuna parte: si
   *  ribattevano ogni volta dentro la finestra della fattura, e da lì non
   *  tornavano indietro. Chi telefona due mesi dopo per la seconda fattura
   *  ricominciava da capo.
   *  ⚠️ Facoltativi sul serio: un lead è una persona che ha chiesto
   *   informazioni, non una pratica fiscale. Nessuna schermata li chiede per
   *   andare avanti, e una scheda senza questi campi è una scheda normale.
   *  ⚠️ `eta` qui sopra RESTA: arriva dal modulo pubblico (è la persona che la
   *   dichiara) e si ricalcola da `dataNascita` quando c'è. Due campi per la
   *   stessa cosa sarebbero un guaio, ma qui le fonti sono due e dicono cose
   *   diverse — quella dichiarata e quella anagrafica. */
  codiceFiscale?: string;
  /** "1980-01-01": si ricava dal codice fiscale, non si chiede. */
  dataNascita?: string;
  sesso?: "M" | "F";
  /** La residenza vera, quella che va in fattura. ⚠️ NON è
   *  `spedizione.indirizzo`: quello è dove va consegnato l'impianto — possono
   *  coincidere, e spesso coincidono, ma una consegna in ufficio non cambia la
   *  residenza di nessuno. */
  residenza?: {
    indirizzo?: string;
    cap?: string;
    comune?: string;
    provincia?: string;
  };
  /** promozione applicata al lead */
  promo?: boolean | string;
  /** arrivata da un'importazione, non dal funnel */
  importato?: boolean;
  /** ── È RICOMPARSA IN UNA LISTA IMPORTATA ────────────────────────────────
   *  Quante volte, quando, da quale file, e se aspetta una decisione.
   *  LO SCRIVE l'importazione (crm/importa/PannelloCarica) e lo spengono i due
   *  pulsanti della coda; LO LEGGONO la coda dei «Lead importati» e la scheda
   *  del lead, che ne ricava le righe non modificabili.
   *  ⚠️ Tutta la regola sta in crm/importa/ricarico.ts, e nessuno compone
   *   questo oggetto a mano: un secondo punto che lo scrive è un secondo modo
   *   di contare le volte. */
  ricarico?: RicaricoLead;
  /** quante volte non ha risposto: guida i richiami */
  noRispondeCount?: number;
  /** ── MESSO DA PARTE DALLA POSTAZIONE ────────────────────────────────────
   *  Quando è stato SALTATO in /CRM/importa: il momento (ISO) e il nome di chi
   *  ha premuto. Finché c'è la data, quel contatto non compare nella coda delle
   *  chiamate e sta nella scheda «Lead saltati», da cui lo si rimette in coda —
   *  gesto che cancella questi due campi.
   *  LI SCRIVE la postazione «uno alla volta» (crm/importa/saltati.ts, che è
   *  l'unico punto in cui si compongono); LI LEGGONO la coda di quella pagina e
   *  la scheda dei saltati.
   *  ⚠️ IL SALTO STA SULLA SCHEDA, non in un elenco a parte, e la ragione è la
   *   stessa per cui la coda si CALCOLA invece di tenersi scritta: un elenco di
   *   id conservato altrove sopravvive alla scheda che è stata cancellata,
   *   venduta o riassegnata, e un giorno dice cose che l'archivio smentisce.
   *   Qui il salto viaggia con la persona — e vale per la persona, non per il
   *   browser: se lo salta un setter, lo vede anche l'altro.
   *  `saltatoDa` è il nome del consulente collegato col PIN, quando c'è: senza
   *  PIN si è entrati con l'account padrone e non c'è nessun nome da scrivere,
   *  quindi resta vuoto. Serve a leggere l'elenco («questo l'ha messo da parte
   *  Marco»), MAI a decidere chi può rimetterlo in coda. */
  saltatoIl?: string;
  saltatoDa?: string;
  /** ── RIPESCATA DAL MAGAZZINO DELLE FERME ────────────────────────────────
   *  Quando le si è riscritto dalla scheda «Ripesca» (crm/importa/ripesca).
   *  ⚠️ NON è uno stato e non ne cambia nessuno: scrivere a qualcuno non è
   *   avere una risposta. Serve a non riscrivere alla stessa persona ogni
   *   volta che si apre la pagina — cosa che succederebbe, perché il suo stato
   *   resta quello di prima e l'elenco la rimetterebbe in cima. */
  ripescatoIl?: string;
  ripescatoDa?: string;
  ripescatoVolte?: number;
  /** ── UNITA DENTRO UN'ALTRA SCHEDA ───────────────────────────────────────
   *  L'id della scheda che è rimasta (vedi crm/doppioni). Chi ce l'ha è stato
   *  assorbito: non si cancella — un'unione è un'ipotesi, e due fratelli con
   *  lo stesso numero di casa sono due persone — ma esce dagli elenchi.
   *  Togliere questo campo e il salto rimette tutto com'era. */
  unitoIn?: string;
  unitoIl?: string;
  /** Gli id delle schede su cui qualcuno ha risposto «non è la stessa
   *  persona»: senza, la stessa coppia ricompare a ogni apertura e alla terza
   *  volta non la guarda più nessuno. */
  nonDoppioneDi?: string[];
  /** già presente in archivio quando è rientrata, e quante volte */
  giaPresente?: boolean;
  giaPresenteCount?: number;
  /** quanti acquisti ha già fatto il cliente */
  acquisti?: number | unknown[];
  /** Dettaglio facoltativo degli acquisti (prodotto, data, importo).
   *  Vive ACCANTO a "acquisti" e non lo sostituisce: nelle schede già salvate
   *  "acquisti" è un numero (o, negli archivi importati, un array) e continua a
   *  funzionare da solo. Quando ci sono righe, chi le scrive tiene "acquisti"
   *  allineato al loro numero, così le pagine che leggono solo il contatore
   *  restano corrette senza sapere nulla del dettaglio. */
  acquistiDettaglio?: RigaAcquisto[];
  /** stato precedente: serve a tornare indietro da "Concluso" */
  previousStato?: LeadStatus;
  /** ricontatto automatico */
  reminderSent?: boolean;
  callbackAt?: string;
  // Motivo perso (obbligatorio per stati LOST_STATUSES)
  lostReason?: LostReason;
  lostReasonNote?: string;
  lostReasonAt?: string; // ISO data registrazione motivo
}

export interface Lead {
  id: string;
  user_id: string;
  data: LeadData;
  created_at: string;
  updated_at: string;
}

/** Quante volte ha comprato questo cliente.
 *  Una sola regola, in un solo posto: se ci sono righe di dettaglio comandano
 *  loro (sono il dato più preciso), altrimenti vale il contatore scritto a
 *  mano. Il vecchio formato ad array — arrivato dagli archivi importati — conta
 *  per lunghezza, così le schede storiche non mostrano "0 acquisti". */
export function contaAcquisti(d: Pick<LeadData, "acquisti" | "acquistiDettaglio">): number {
  if (d.acquistiDettaglio && d.acquistiDettaglio.length > 0) return d.acquistiDettaglio.length;
  if (Array.isArray(d.acquisti)) return d.acquisti.length;
  const n = Number(d.acquisti);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

/** Recupera le righe leggibili da un "acquisti" vecchio stile ad array.
 *  Gli archivi importati a volte portano già gli oggetti degli acquisti, con
 *  nomi di campo diversi dai nostri. Buttarli e ripartire da un contatore
 *  perderebbe informazione che il cliente ci ha già dato: qui si traduce quel
 *  poco che è riconoscibile, e il resto resta semplicemente conteggio. */
export function righeAcquistoDaArchivio(acquisti: unknown): RigaAcquisto[] {
  if (!Array.isArray(acquisti)) return [];
  const righe: RigaAcquisto[] = [];
  acquisti.forEach((voce, i) => {
    if (!voce || typeof voce !== "object") return;
    const v = voce as Record<string, unknown>;
    const prodotto = [v.prodotto, v.nome, v.product, v.name, v.descrizione].find(
      (x) => typeof x === "string" && x.trim(),
    ) as string | undefined;
    if (!prodotto) return;
    const dataGrezza = [v.data, v.date, v.dataAcquisto].find(
      (x) => typeof x === "string" && x.trim(),
    ) as string | undefined;
    const importoGrezzo = [v.importo, v.prezzo, v.amount, v.total].find(
      (x) => typeof x === "number" && Number.isFinite(x),
    ) as number | undefined;
    righe.push({
      id: `arch-${i}`,
      prodotto: prodotto.trim(),
      data: dataGrezza ? dataGrezza.slice(0, 10) : undefined,
      importo: importoGrezzo,
    });
  });
  return righe;
}

// ---------- Public Lead (dal funnel pubblico) ----------

export interface PublicLead {
  id: string;
  created_at: string;
  updated_at: string;
  nome: string;
  cognome: string;
  email: string;
  telefono: string;
  citta: string;
  data_slot: string | null;
  ora_slot: string | null;
  disagio_score: number | null;
  pain_points: string[];
  urgenza: "si" | "valutando" | "subito" | "1mese" | "convince" | "2_3mesi" | "valuto" | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  fbp: string | null;
  fbc: string | null;
  ttclid: string | null;
  ip_hash: string | null;
  user_agent: string | null;
  event_id: string | null;
  status: string;
  assigned_to_user_id: string | null;
  assigned_consultant_id: string | null;
  meet_link: string | null;
  notes: string | null;
  slot_released?: boolean;
  slot_pending?: boolean;
  portatore?: boolean | null;
  accepted_at?: string | null;
  accepted_by_consultant_id?: string | null;
  reminder_sent_at?: string | null;
}

export function detectPublicLeadSource(p: PublicLead): "meta" | "tiktok" | "organic" {
  const s = (p.utm_source || "").toLowerCase();
  if (s.includes("tiktok") || p.ttclid) return "tiktok";
  if (s.includes("facebook") || s.includes("meta") || s.includes("instagram") || p.fbp || p.fbc)
    return "meta";
  return "organic";
}

// ---------- Consulenti ----------

export interface FasciaOraria {
  inizio: string; // "09:00"
  fine: string; // "13:00"
}

export interface Pausa {
  giorno: number; // 0-6
  inizio: string;
  fine: string;
}

// Indisponibilità per data specifica
export interface IndisponibilitaCustom {
  data: string; // YYYY-MM-DD
  // Se inizio/fine null → tutto il giorno indisponibile
  inizio?: string;
  fine?: string;
  motivo?: string;
}

export type ConsultantStatus = "approved" | "pending" | "rejected";

export interface ConsultantData {
  nome: string;
  email?: string;
  telefono?: string;
  calendarioCollegato?: boolean;
  googleEmail?: string; // email Google collegata via OAuth
  giorniLavorativi: number[]; // 0-6
  fasceOrarie: FasciaOraria[];
  // Fasce orarie per giorno della settimana (override delle generali)
  fasceOrarieGiorno?: Record<number, FasciaOraria[]>;
  pause?: Pausa[];
  indisponibilita?: IndisponibilitaCustom[];
  maxCallGiorno?: number;
  attivo: boolean;
  priorita?: number;
  callOggi?: number;
  // Stato approvazione (default approved per consulenti creati da admin)
  approvalStatus?: ConsultantStatus;
  applicationId?: string; // se viene da una richiesta pubblica
}

export interface Consultant {
  id: string;
  user_id: string;
  data: ConsultantData;
  created_at: string;
  updated_at: string;
}

// ---------- Ad spending ----------

export interface AdSpendingData {
  data: string; // ISO date
  campagna: string;
  fonte: string;
  importoSpeso: number;
  leadGenerati: number;
  meetFissati: number;
  conversioni: number;
}

export interface AdSpending {
  id: string;
  user_id: string;
  data: AdSpendingData;
  created_at: string;
  updated_at: string;
}

// ---------- PIN ----------

export interface ConsultantPermissions {
  canChangeStatus: boolean;
  canChangeTime: boolean;
  canAddNotes: boolean;
  canAddPostCallNotes: boolean;
  canChangePayment: boolean;
  canDeleteLead: boolean;
  canAddLead: boolean;
}

export interface ConsultantPin {
  id: string;
  admin_user_id: string;
  consultant_id: string;
  pin: string;
  permissions: ConsultantPermissions;
  commission_percentage: number;
  active: boolean;
  created_at: string;
}

export const DEFAULT_PERMISSIONS: ConsultantPermissions = {
  canChangeStatus: true,
  canChangeTime: true,
  canAddNotes: true,
  canAddPostCallNotes: true,
  canChangePayment: false,
  canDeleteLead: false,
  canAddLead: false,
};

// Stati selezionabili manualmente dall'utente.
// "acconto" è gestito automaticamente dal pagamento: appena viene inserito un acconto > 0
// nella scheda pagamento, lo stato diventa "acconto" automaticamente.
// ── DUE MOMENTI, DUE ELENCHI ───────────────────────────────────────────────
//  Gli esiti di una lista da chiamare e gli esiti di un lead già avviato non
//  sono la stessa cosa, e mescolarli è il modo più rapido per sbagliare stato
//  con la persona in linea: chi sta lavorando una lista cerca "non risponde",
//  chi ha appena chiuso una consulenza cerca "sta valutando".
//  Un lead importato mostra i PRIMI, più l'appuntamento — che è il momento in
//  cui smette di essere una riga di una lista e diventa un lead in lavorazione.
/** ── LA PRIMA CHIAMATA È ANCORA APERTA ─────────────────────────────────────
 *  I quattro stati in cui una scheda deve ancora essere telefonata. Sono
 *  `STATI_PRIMO_CONTATTO` meno quelli che la chiudono: chi ha detto no («Non
 *  interessato»), chi ha un appuntamento e chi ha comprato hanno smesso di
 *  essere righe da chiamare e sono diventati trattative — le seguono l'agenda e
 *  /CRM/trattative, non la postazione delle chiamate.
 *
 *  ⚠️ STA QUI, E NON DENTRO UNA PAGINA, perché è la risposta a «quanti me ne
 *   restano da chiamare» — e quella domanda la fanno la coda del setter, il
 *   conteggio in cima e l'elenco completo. Finché la definizione stava dentro
 *   routes/CRM.importa, l'elenco «Tutti» contava OGNI scheda importata: 843
 *   righe di cui 43 da telefonare, con dentro i 209 che avevano già detto no e
 *   gli appuntamenti già fissati. Un numero che nessuno poteva usare per
 *   decidere quanto lavoro restava. */
export const STATI_DA_CHIAMARE: LeadStatus[] = [
  "da_contattare",
  "non_risponde",
  "segreteria",
  "richiamo",
  /*  ⚠️ C'È ANCHE CHI DEVE RICHIAMARE LUI, ma non prima del giorno che ha
      detto: fino ad allora la coda lo salta (`eDaChiamare` in CRM.importa, la
      stessa eccezione del richiamo concordato). Tenerlo fuori del tutto
      sarebbe comodo e sbagliato: «vi faccio sapere io» senza nessuno che
      guardi il calendario è il modo più elegante di perdere un lead — passa
      il giorno, non si fa vivo, e non lo richiama più nessuno. */
  "ci_ricontatta_lui",
];

/** Vero se questa scheda deve ancora essere telefonata. Accetta stringhe
 *  grezze: lo stato arriva dal database e può essere qualcosa che non conosciamo. */
export const eStatoDaChiamare = (stato?: string | null): boolean =>
  (STATI_DA_CHIAMARE as string[]).includes(String(stato ?? ""));

export const STATI_PRIMO_CONTATTO: LeadStatus[] = [
  "da_contattare",
  "non_risponde",
  "segreteria",
  "richiamo",
  /*  ⚠️ «VI FACCIO SAPERE IO» È UN ESITO DI PRIMO CONTATTO, e il committente
      l'ha chiesto proprio per qui: «fallo sia per il setter lead importati sia
      per i lead effettivi». Al telefono, su una lista, è una delle risposte
      più frequenti — e finché non aveva un tasto suo finiva segnata
      «Richiamo concordato», cioè un impegno NOSTRO che nessuno aveva preso. */
  "ci_ricontatta_lui",
  "annullato",
  "appuntamento_fissato",
  //  Lavorando una lista importata capita di riconoscere qualcuno che era già
  //  in archivio: l'esito di quella telefonata è un appuntamento di ritorno, e
  //  deve essere scegliibile lì dove si sta lavorando, non altrove.
  "appuntamento_rifissato",
];

/** Gli esiti di un lead già avviato. Il nome della costante resta
 *  STATI_TRATTATIVA: è un riferimento interno, lo importano altri file. */
export const STATI_TRATTATIVA: LeadStatus[] = [
  "appuntamento_fissato",
  "appuntamento_rifissato",
  //  "non_fatto" / "da_spostare" NON stanno qui: si assegnano con i DUE
  //  pulsanti dedicati, che sono un gesto solo. Dentro il menu erano voci in
  //  mezzo ad altre dodici — e l'esito di un appuntamento si segna venti volte
  //  al giorno, mentre gli altri stati una ogni tanto.
  //  "fatto" non c'è perché non si assegna più affatto: la consulenza risulta
  //  svolta scegliendo qui com'è ANDATA (una delle tre chiusure, in
  //  valutazione, ricontatto fissato…), non marcandola una seconda volta.
  //  ── HA COMPRATO: SI SCEGLIE ANCHE COME GLI ARRIVA ──────────────────────
  //   Al posto dell'unico "Venduto". Sono tre voci invece di una e si sceglie
  //   comunque una volta sola, ma quella volta si dice tutto: chi legge la riga
  //   dopo sa già se deve trovare un posto in agenda, mandare un tecnico a casa
  //   o preparare un pacco.
  ...STATI_CHIUSURA_VINTA,
  "in_attesa_acconto",
  "viene_in_sede",
  "sede_disdetta",
  "gestire_in_chat",
  "sta_valutando",
  //  Sta qui e NON fra gli esiti di primo contatto: presuppone che ci si sia
  //  già parlati. In una lista da chiamare il silenzio si segna con "Non
  //  risponde", che porta con sé il contatore dei tentativi.
  "irreperibile",
  "da_ricontattare",
  //  E anche qui, sull'altra metà della richiesta: dopo una consulenza «ci
  //  sentiamo noi» e «vi faccio sapere io» sono due esiti diversi, e solo il
  //  secondo vieta di richiamare prima del giorno promesso.
  "ci_ricontatta_lui",
  "fissa_meet_dopo",
  "no_show",
  "annullato",
  //  ── L'USCITA NEGATIVA DI «ATTESA ACCONTO» ────────────────────────────
  //   Sta qui e NON fra gli esiti di primo contatto: presuppone che ci sia
  //   stata una trattativa e un sì. Su una lista da chiamare non può capitare,
  //   e offrirlo lì vorrebbe dire una voce in più da scartare a ogni telefonata.
  "ripensamento",
  "perdi_tempo",
  //  "venduto" e "concluso" NON ci sono più: il primo è sostituito dalle tre
  //  chiusure, il secondo si raggiunge dal pulsante che archivia la pratica
  //  (chiudiTrattativa), che è un gesto suo e ha il suo ritorno indietro.
];

/** L'elenco giusto per QUESTO lead. */
export function statiPer(l: {
  importato?: boolean;
  dataMeeting?: string;
  consulenteId?: string | null;
}): LeadStatus[] {
  const inLista = !!l.importato && !(l.dataMeeting && l.consulenteId);
  return inLista ? STATI_PRIMO_CONTATTO : STATI_TRATTATIVA;
}

export const SELECTABLE_LEAD_STATUSES: LeadStatus[] = [
  // ── PRIMA DELLA CONSULENZA ──────────────────────────────────────────────
  //  Mancavano tutti: dall'elenco non si poteva segnare "non risponde" né
  //  "segreteria", cioè gli esiti più frequenti in assoluto di una giornata al
  //  telefono. L'ordine è quello in cui capitano davvero.
  "da_contattare",
  "non_risponde",
  "segreteria",
  "richiamo",
  "appuntamento_fissato",
  "appuntamento_rifissato",
  //  "non_fatto" / "da_spostare" NON stanno qui: si assegnano con i DUE
  //  pulsanti dedicati, che sono un gesto solo.
  //  "fatto" non c'è più nemmeno lì: è uno stato storico che non si assegna,
  //  perché «svolta» è ormai un calcolo (vedi eStatoNonSvolta).
  //  Le tre chiusure vinte stanno insieme e in fila: nella griglia devono
  //  leggersi come una scelta sola in tre varianti, non come tre esiti diversi
  //  sparsi fra gli altri.
  ...STATI_CHIUSURA_VINTA,
  "in_attesa_acconto",
  "viene_in_sede",
  "sede_disdetta",
  "gestire_in_chat",
  "sta_valutando",
  "irreperibile",
  "da_ricontattare",
  //  Accanto al ricontatto, che è la sua coppia: dopo «ci penso» le due
  //  risposte più frequenti sono «richiamatemi» e «vi faccio sapere io», e
  //  vederle vicine è quello che impedisce di segnare l'una per l'altra.
  "ci_ricontatta_lui",
  "fissa_meet_dopo",
  "no_show",
  "annullato",
  //  ── L'USCITA NEGATIVA DI «ATTESA ACCONTO» ────────────────────────────
  //   Sta qui e NON fra gli esiti di primo contatto: presuppone che ci sia
  //   stata una trattativa e un sì. Su una lista da chiamare non può capitare,
  //   e offrirlo lì vorrebbe dire una voce in più da scartare a ogni telefonata.
  "ripensamento",
  "perdi_tempo",
  //  ⚠️ VIA "venduto" E "concluso", MA SOLO DA QUI E DAGLI ALTRI ELENCHI DA
  //   SCEGLIERE. Restano nel tipo, nelle etichette, nelle fasi e in
  //   ALL_LEAD_STATUSES: in archivio ci sono schede che li portano e devono
  //   continuare a leggersi e a contare nei numeri. È lo stesso trattamento che
  //   ha già avuto "fatto" — si smette di assegnarli, non di riconoscerli.
];

// Tutti gli stati esistenti, inclusi quelli automatici (per pipeline, KPI, filtri).
// ── DEVONO ESSERCI DAVVERO TUTTI ───────────────────────────────────────────
//  Mancavano "fatto", "non_fatto" e "da_spostare" perché si assegnano con i
//  pulsanti dell'esito e non dal menu — e "fatto" oggi non si assegna proprio
//  più. Ma questo elenco non serve a scegliere uno stato: serve a MOSTRARLI, e
//  le schede storiche segnate "fatto" ci sono ancora. La pipeline raggruppa su questa lista e
//  scarta ciò che non trova, quindi una consulenza appena svolta spariva dalla
//  pipeline e non era filtrabile da nessuna parte — cioè il lead più caldo
//  della giornata era l'unico invisibile.
export const ALL_LEAD_STATUSES: LeadStatus[] = [
  "da_contattare",
  "non_risponde",
  "segreteria",
  "richiamo",
  "annullato",
  "ripensamento",
  "appuntamento_fissato",
  "appuntamento_rifissato",
  "fatto",
  "non_fatto",
  "da_spostare",
  //  "venduto" e "concluso" non si assegnano più, ma QUI ci sono e ci restano:
  //  questo elenco non serve a scegliere, serve a MOSTRARE. Toglierli farebbe
  //  sparire dalla pipeline e dai filtri le schede storiche che li portano —
  //  cioè, fra le altre, tutte le vendite fatte fino a ieri.
  "venduto",
  ...STATI_CHIUSURA_VINTA,
  "acconto",
  "in_attesa_acconto",
  "viene_in_sede",
  "sede_disdetta",
  "gestire_in_chat",
  "sta_valutando",
  "irreperibile",
  "da_ricontattare",
  //  Richiesta del committente: deve essere scegliibile «sia per il setter sui
  //  lead importati sia sui lead effettivi». Essendo qui, entra da solo anche
  //  negli esiti di chiamata (POST_CALL_STATUSES, che deriva da questo elenco)
  //  e in tutte le schermate che offrono gli stati.
  "ci_ricontatta_lui",
  "fissa_meet_dopo",
  "no_show",
  "perdi_tempo",
  "concluso",
];

// ── ESITI DI UNA CHIAMATA ──────────────────────────────────────────────────
//  Sono gli stati che si scelgono APPENA CHIUSA la telefonata. "Da contattare"
//  e "Concluso" non lo sono: il primo è il punto di partenza, il secondo è la
//  chiusura della pratica, e mescolarli agli esiti fa scegliere l'uno per
//  l'altro con la persona ancora in linea.
//  Fuori anche "fatto": è un elenco di cose da SCEGLIERE, e quello stato non si
//  assegna più (la consulenza risulta svolta da sola, per esclusione).
//  ⚠️ E fuori "venduto" per la stessa identica ragione: da oggi la vendita si
//   segna scegliendo COME arriva l'impianto (le tre chiusure vinte, che questo
//   elenco eredita da ALL_LEAD_STATUSES). Lasciarcelo avrebbe rimesso davanti a
//   chi ha appena riattaccato la vecchia voce generica accanto alle tre nuove:
//   quattro modi di dire "ha comprato", e tre quarti delle vendite sarebbero
//   tornate senza il modo di consegna.
export const POST_CALL_STATUSES: LeadStatus[] = ALL_LEAD_STATUSES.filter(
  (s) => s !== "concluso" && s !== "da_contattare" && s !== "fatto" && s !== "venduto",
);

// ---------- Motivo lead perso ----------
// Stati che richiedono OBBLIGATORIAMENTE un motivo perso.
export const LOST_STATUSES: LeadStatus[] = ["concluso", "perdi_tempo", "no_show"];

export type LostReason =
  | "prezzo"
  | "tempo"
  | "concorrenza"
  | "no_show"
  | "non_qualificato"
  | "ripensamento"
  | "non_risponde"
  | "altro";

//  Un motivo si sceglie in fretta solo se le voci non si sovrappongono: sono
//  frasi brevi al passato, una per causa, senza doppie diciture separate da
//  barra (con la barra si finisce per scegliere sempre la prima voce buona).
export const LOST_REASON_LABEL: Record<LostReason, string> = {
  prezzo: "Prezzo fuori budget",
  tempo: "Non è il momento",
  concorrenza: "Scelto un concorrente",
  no_show: "Non si è presentato",
  non_qualificato: "Non qualificato (budget o esigenza)",
  ripensamento: "Ci ha ripensato",
  non_risponde: "Non risponde più",
  altro: "Altro",
};

export const LOST_REASON_OPTIONS: LostReason[] = [
  "prezzo",
  "tempo",
  "concorrenza",
  "no_show",
  "non_qualificato",
  "ripensamento",
  "non_risponde",
  "altro",
];

// Helper: applica le regole automatiche di stato in base al pagamento.
// Regola: se è stato inserito un importo di acconto > 0, lo stato diventa "acconto",
// a meno che lo stato sia già "venduto" o "concluso".
/** ── I DUE COSTI PREDEFINITI ──────────────────────────────────────────────
 *  Chiesti dal committente, e stanno qui perché li usano due posti: la
 *  finestra dei costi, che li propone, e `applyAutoStatus`, che li mette sui
 *  pacchi. Scritti due volte, il giorno che cambia il listino ne cambierebbe
 *  uno solo. */
export const COSTO_PARRUCCHIERE_PREDEFINITO = 25;
export const COSTO_SPEDIZIONE_PREDEFINITO = 8;

/** ── ⚠️ QUANDO LO STATO L'HA SCELTO UNA PERSONA ────────────────────────────
 *  `statoScelto` vuol dire: in questo salvataggio qualcuno ha detto ESPLICITAMENTE
 *  dove va questa scheda (ha aperto la tendina, ha premuto un esito). Lo passa
 *  `updateLead` guardando se la modifica porta un `stato` dentro (crm/CRMContext).
 *
 *  ⚠️ SERVE PERCHÉ UNA REGOLA AUTOMATICA NON PUÒ SCAVALCARE UNA DECISIONE.
 *   Segnalazione del committente: da «Acconto incassato» non si riusciva a
 *   passare a nessun altro stato — si sceglieva, compariva pure la conferma
 *   «Michele Porrozzi → Cliente assente», e la riga restava «Acconto
 *   incassato». Non era un salvataggio mancato: la scrittura partiva e poi la
 *   riga qui sotto la riportava indietro, perché in cassa c'erano dei soldi.
 *   La regola dell'acconto è un'INDUZIONE — «se è entrato un acconto allora la
 *   trattativa è vinta» — e serve a chi scrive una cifra senza toccare lo
 *   stato. Davanti a una persona che lo stato lo sta scegliendo non ha più
 *   niente da indovinare.
 *   Che fosse troppo larga si vedeva già: erano state ritagliate a mano tre
 *   eccezioni (le chiusure vinte, «concluso», «ripensamento»), una per ogni
 *   volta che qualcuno ci è sbattuto contro. Questa le generalizza.
 *  ⚠️ IL RESTO DELLE REGOLE VALE SEMPRE, scelta o no: i costi di un pacco, gli
 *   importi azzerati da «perdi tempo», il saldo ricalcolato. Quelle non
 *   contraddicono nessuno — mettono in ordine i numeri di quello che è stato
 *   deciso. */
export function applyAutoStatus(
  data: LeadData,
  opzioni?: { statoScelto?: boolean },
): LeadData {
  let d = data;

  /*  ── ⚠️ UN PACCO NON HA UN INSTALLATORE NÉ UN PARRUCCHIERE ─────────────
      Chiesto dal committente: quando una pratica diventa una SPEDIZIONE, i
      costi dell'installatore e del parrucchiere devono sparire, e al loro
      posto ci va il costo del corriere.
      Non è un vezzo contabile: quei due costi restavano scritti da quando la
      pratica era una posa, il margine continuava a sottrarli, e ogni pacco
      risultava meno redditizio del vero — su un impianto spedito a 240 € con
      50 di installatore e 25 di parrucchiere sono 75 € di utile che non
      esistono.

      ⚠️ SI FA QUI, E NON DOVE SI PREME «SPEDISCI». Il modo di consegna si
       cambia da almeno quattro posti — la finestra della posa, il menu «…»,
       lo stato del lead (MODO_CONSEGNA_DA_STATO), l'importazione — e
       agganciare la pulizia a ognuno vorrebbe dire scordarsene in uno. Questa
       funzione gira dentro `updateLead` a OGNI salvataggio: è l'unico posto
       da cui passano tutti.
      ⚠️ E il costo del corriere si propone solo se non c'è ancora: chi lo ha
       già corretto a 12 € non se lo deve ritrovare riportato a 8 al
       salvataggio dopo. */
  if (
    d.payment?.costi &&
    (d.installazione as { spedizione?: { modo?: string } } | undefined)?.spedizione?.modo ===
      "spedizione"
  ) {
    const c = d.payment.costi;
    const daPulire = (c.costoInstallatore ?? 0) !== 0 || (c.costoTaglio ?? 0) !== 0;
    const senzaSpedizione = c.costoSpedizione == null;
    if (daPulire || senzaSpedizione) {
      d = {
        ...d,
        payment: {
          ...d.payment,
          costi: {
            ...c,
            costoInstallatore: 0,
            costoTaglio: 0,
            costoSpedizione: c.costoSpedizione ?? COSTO_SPEDIZIONE_PREDEFINITO,
          },
        },
      };
    }
  }
  // ── PERDI TEMPO AZZERA I CONTI ───────────────────────────────────────────
  //  Un lead dichiarato perdita di tempo non può continuare a pesare sul
  //  venduto e sugli incassi previsti: gli importi si azzerano insieme allo
  //  stato, non "quando qualcuno se ne ricorda".
  if (d.stato === "perdi_tempo" && d.payment) {
    d = {
      ...d,
      payment: {
        ...d.payment,
        prezzoTotale: 0,
        prezzoFinaleVendita: 0,
        accontoPagato: 0,
        saldoRimanente: 0,
        statoPagamento: "nessun_pagamento",
      },
    };
  }
  // ── LO STATO DEL PAGAMENTO SI CALCOLA, NON SI DIGITA ─────────────────────
  //  Tre righe che devono essere sempre d'accordo fra loro: quanto manca,
  //  a che punto è il pagamento, e quanto è stato incassato. Lasciarle a mano
  //  significa ritrovarsi un "pagato interamente" con il saldo ancora aperto.
  if (d.payment) {
    const finale = Number(d.payment.prezzoFinaleVendita) || 0;
    const acc = Number(d.payment.accontoPagato) || 0;
    const stato: StatoPagamento =
      finale <= 0 || acc <= 0
        ? "nessun_pagamento"
        : acc < finale
          ? "acconto_ricevuto"
          : "pagato_interamente";
    //  ⚠️ NON SI RICALCOLA SENZA PREZZO, E QUI SI PERDEVANO SOLDI VERI.
    //   Questa funzione gira a OGNI salvataggio di un lead, anche su uno che
    //   coi soldi non c'entra niente. Sulle pratiche riprese dall'archivio il
    //   prezzo di vendita non c'è (vale 0) e `saldoRimanente` è l'UNICO residuo
    //   che esiste — tanto che il saldo alla consegna lo usa apposta come
    //   ripiego. Con `finale` a 0, `finale - acc` lo azzerava: bastava scrivere
    //   l'indirizzo o il costo del viaggio su una di quelle pratiche perché
    //   «resta 1.200 €» diventasse «incassato». E i campi che si scrivono
    //   direttamente sulla riga salvano a ogni uscita dal campo, quindi da oggi
    //   sarebbe successo spesso.
    if (
      finale > 0 &&
      (d.payment.saldoRimanente !== finale - acc || d.payment.statoPagamento !== stato)
    ) {
      d = { ...d, payment: { ...d.payment, saldoRimanente: finale - acc, statoPagamento: stato } };
    } else if (d.payment.statoPagamento !== stato) {
      d = { ...d, payment: { ...d.payment, statoPagamento: stato } };
    }
  }
  const acconto = d.payment?.accontoPagato || 0;
  //  ⚠️ L'ACCONTO NON DEVE MANGIARSI UNA CHIUSURA GIÀ SCELTA.
  //   Questa riga girava su due soli stati ("venduto", "concluso") perché due
  //   soli ce n'erano. Con le tre chiusure vinte, un lead segnato «Da spedire»
  //   a cui si registra l'acconto sarebbe tornato «Acconto incassato»: il
  //   totale del mese non cambia (sono entrambi vinti), ma sparisce l'unica
  //   riga che diceva di preparare un pacco — e il pacco non lo prepara più
  //   nessuno. Si legge da eChiusuraVinta, così il giorno che le chiusure
  //   diventino quattro questa riga non va ritrovata.
  //  ⚠️ «ripensamento» È ESCLUSO, e senza questa riga lo stato non si sarebbe
  //   potuto assegnare affatto a chi aveva già versato qualcosa. Chi lascia
  //   100 € di acconto e poi si tira indietro è il caso NORMALE di questo
  //   stato, non quello raro: senza l'eccezione, chi lo segnava lo vedeva
  //   tornare «Acconto incassato» da solo al primo salvataggio, e la pratica
  //   sarebbe restata a contare come vendita nel totale del mese.
  //   Gli importi NON si azzerano (a differenza di «perdi_tempo»): se
  //   l'acconto vada restituito o trattenuto è una decisione di cassa, non uno
  //   stato, e cancellarla qui farebbe sparire dei soldi davvero incassati.
  if (
    acconto > 0 &&
    //  ⚠️ Una scelta fatta a mano vince sempre: vedi `statoScelto` in cima.
    !opzioni?.statoScelto &&
    !eChiusuraVinta(d.stato) &&
    d.stato !== "concluso" &&
    d.stato !== "ripensamento"
  ) {
    return { ...d, stato: "acconto" };
  }
  return d;
}

/** ── A CHI TOCCA QUESTO LEAD ───────────────────────────────────────────────
 *  Il consulente si sceglie da solo: fra quelli attivi che non hanno ancora
 *  esaurito le chiamate di oggi, tocca a chi ne ha fatte MENO; a pari
 *  chiamate decide la priorità. Serve a distribuire il lavoro senza che
 *  qualcuno debba ricordarsi chi ha già preso quanti lead — ed è ciò che
 *  evita che i lead migliori finiscano sempre sulla stessa persona.
 *  Restituisce null quando sono tutti al completo: meglio un lead non
 *  assegnato che un lead assegnato a chi non può richiamarlo. */
export function migliorConsulente<T extends { id: string; data: ConsultantData }>(
  consulenti: T[],
): T | null {
  const liberi = consulenti.filter(
    (c) => c.data.attivo && (c.data.callOggi ?? 0) < (c.data.maxCallGiorno ?? 10),
  );
  if (!liberi.length) return null;
  return [...liberi].sort((a, b) => {
    const ca = a.data.callOggi ?? 0,
      cb = b.data.callOggi ?? 0;
    if (ca !== cb) return ca - cb;
    return (a.data.priorita ?? 1) - (b.data.priorita ?? 1);
  })[0];
}

/** ── CHIUDI E RIAPRI UN LEAD ───────────────────────────────────────────────
 *  Chiudere è facile, tornare indietro no: senza ricordare da dove si veniva,
 *  riaprire significa scegliere uno stato a caso. Qui la provenienza viene
 *  salvata alla chiusura e restituita alla riapertura.
 *  I nomi chiudiTrattativa/riapriTrattativa restano: li importano altri file e
 *  rinominarli sposterebbe il problema senza cambiare una riga a schermo. */
export function chiudiTrattativa(d: LeadData): Partial<LeadData> {
  return { stato: "concluso", previousStato: d.stato };
}
export function riapriTrattativa(d: LeadData): Partial<LeadData> {
  //  ── QUANDO NON SI SA DA DOVE SI VENIVA ───────────────────────────────────
  //   `previousStato` c'è sempre sulle pratiche chiuse da noi, quindi il
  //   ripiego serve solo alle schede vecchie dell'archivio, che sono state
  //   chiuse quando quel campo non si salvava ancora. Il ripiego era "venduto",
  //   cioè «riaprendo, dai per vinta»: il significato resta quello — cambia solo
  //   che oggi una vendita deve dire anche COME arriva l'impianto, e uno stato
  //   che non si assegna più non va riscritto su una scheda che si sta
  //   salvando adesso.
  //   Il modo giusto non si indovina: lo dice la pratica stessa, nel campo che
  //   già decide se sta in agenda o parte come pacco. Se non dice niente vale
  //   la posa da noi, che è il caso normale ed è il valore di partenza anche là.
  if (d.previousStato) return { stato: d.previousStato, previousStato: undefined };
  const consegna = d.installazione?.spedizione;
  const modo = consegna?.modo ?? (consegna?.daSpedire ? "spedizione" : "sede");
  const vinto: LeadStatus =
    modo === "spedizione"
      ? "posa_da_spedire"
      : modo === "domicilio"
        ? "posa_a_domicilio"
        : "posa_in_sede";
  return { stato: vinto, previousStato: undefined };
}
