/**
 * Template WhatsApp pronti per Meta Business Manager.
 *
 * Meta usa PLACEHOLDER POSIZIONALI: {{1}}, {{2}}, {{3}}, ...
 * (le "named variables" non sono supportate dal flusso standard di approvazione,
 * quindi qui usiamo solo numerici, che è ciò che Meta richiede di default.)
 *
 * Il CRM invia i parametri in ORDINE come array, esattamente come Meta si aspetta.
 */

import { SITO } from "@/lib/sito";

export interface MetaTemplateParam {
  /** Posizione 1-based del placeholder nel body ({{1}}, {{2}}, ...) */
  index: number;
  /** Chiave logica usata internamente dal CRM per popolare il valore */
  key:
    | "lead_name"
    | "consultant_name"
    | "appointment_date"
    | "appointment_time"
    | "appointment_day"
    | "visit_date"
    | "visit_time"
    | "recontact_date"
    | "recontact_time"
    | "meet_link"
    | "address";
  /** Descrizione human-readable per documentazione/Meta sample */
  description: string;
  /** Valore d'esempio per la review Meta */
  example: string;
}

export interface MetaTemplate {
  name: string;
  language: string;
  category: "UTILITY" | "MARKETING";
  /** Body con placeholder {{1}}, {{2}}, ... */
  body: string;
  /** Parametri in ordine (index 1..N) */
  params: MetaTemplateParam[];
  /** Solo i modelli `_311026`: il nome del modello vecchio che sostituiscono. */
  sostituisce?: string;
  /** Solo i modelli `_311026`: l'immagine in testa al messaggio. */
  header?: { tipo: "IMAGE"; file: string; url: string; pronta: boolean };
  /** Solo i modelli `_311026`: il pulsante sotto il messaggio. */
  pulsante?: { testo: string; url: string; da?: "meet_link"; esempio?: string };
}

type ParamKey = MetaTemplateParam["key"];

const DESCR: Record<ParamKey, { description: string; example: string }> = {
  lead_name: { description: "Nome del lead", example: "Mario" },
  consultant_name: { description: "Nome del consulente", example: "Luca" },
  appointment_date: { description: "Data appuntamento (DD/MM/YYYY)", example: "12/05/2026" },
  appointment_time: { description: "Ora appuntamento (HH:MM)", example: "15:30" },
  appointment_day: {
    description: "Giorno parlato, es. venerdì 23 ottobre",
    example: "venerdì 23 ottobre",
  },
  visit_date: { description: "Data visita in sede (DD/MM/YYYY)", example: "15/05/2026" },
  visit_time: { description: "Ora visita in sede (HH:MM)", example: "10:00" },
  recontact_date: { description: "Data ricontatto (DD/MM/YYYY)", example: "20/05/2026" },
  recontact_time: { description: "Ora ricontatto (HH:MM)", example: "11:00" },
  meet_link: { description: "Link Google Meet", example: "https://meet.google.com/abc-defg-hij" },
  address: { description: "Indirizzo della sede", example: "Via Esempio 1, Roma" },
};

function tpl(
  name: string,
  category: MetaTemplate["category"],
  bodyTemplate: string,
  keys: ParamKey[],
  language = "it",
  extra: Pick<MetaTemplate, "sostituisce" | "header" | "pulsante"> = {},
): MetaTemplate {
  // Sostituisco {{key}} con {{1}}, {{2}}, ... in base all'ordine in `keys`
  let body = bodyTemplate;
  keys.forEach((k, i) => {
    const re = new RegExp(`\\{\\{${k}\\}\\}`, "g");
    body = body.replace(re, `{{${i + 1}}}`);
  });
  const params: MetaTemplateParam[] = keys.map((k, i) => ({
    index: i + 1,
    key: k,
    description: DESCR[k].description,
    example: DESCR[k].example,
  }));
  return { name, language, category, body, params, ...extra };
}

// Firma: contiene {{consultant_name}} che diventerà l'ultimo placeholder numerico.
const FIRMA = "\n\nA presto,\n{{consultant_name}}\nHair Genius Labs";

export const META_TEMPLATES: MetaTemplate[] = [
  tpl(
    "appuntamento_conferma",
    "UTILITY",
    `Gentile {{lead_name}}, Le confermo l'analisi tecnica gratuita prevista per il {{appointment_date}} alle ore {{appointment_time}}. A breve riceverà il link per collegarsi.${FIRMA}`,
    ["lead_name", "appointment_date", "appointment_time", "consultant_name"],
  ),
  tpl(
    "ringraziamento_vendita",
    "UTILITY",
    `Gentile {{lead_name}}, La ringraziamo per la fiducia accordataci. A breve La contatteremo per organizzare i prossimi step della Sua installazione Bio-Mimetic.${FIRMA}`,
    ["lead_name", "consultant_name"],
  ),
  tpl(
    "acconto_ricevuto",
    "UTILITY",
    `Gentile {{lead_name}}, abbiamo ricevuto correttamente il Suo acconto. Procediamo subito con l'ordine del Suo Bio-Mimetic e La aggiorneremo sulle tempistiche di installazione.${FIRMA}`,
    ["lead_name", "consultant_name"],
  ),
  tpl(
    "promemoria_acconto",
    "UTILITY",
    `Gentile {{lead_name}}, Le scrivo per ricordarLe che siamo in attesa dell'acconto per poter bloccare la data della Sua installazione. Resto a Sua disposizione per qualsiasi chiarimento.${FIRMA}`,
    ["lead_name", "consultant_name"],
  ),
  tpl(
    "conferma_sede",
    "UTILITY",
    `Gentile {{lead_name}}, La aspettiamo presso la nostra sede il giorno {{visit_date}} alle ore {{visit_time}}. L'indirizzo è: Via degli Scipioni 132, Roma. Per qualsiasi necessità non esiti a contattarmi.${FIRMA}`,
    ["lead_name", "visit_date", "visit_time", "consultant_name"],
  ),
  tpl(
    "gestire_in_chat",
    "UTILITY",
    `Gentile {{lead_name}}, può scrivermi qui in chat tutte le Sue domande. Le risponderò personalmente nel più breve tempo possibile.${FIRMA}`,
    ["lead_name", "consultant_name"],
  ),
  tpl(
    "follow_up_valutazione",
    "MARKETING",
    `Gentile {{lead_name}}, La contatto per sapere se ha avuto modo di valutare la nostra proposta. Resto a Sua completa disposizione per qualsiasi dubbio.${FIRMA}`,
    ["lead_name", "consultant_name"],
  ),
  tpl(
    "promemoria_ricontatto",
    "UTILITY",
    `Gentile {{lead_name}}, come d'accordo La ricontatto il {{recontact_date}} alle {{recontact_time}}. Mi confermi pure se l'orario è di Suo gradimento.${FIRMA}`,
    ["lead_name", "recontact_date", "recontact_time", "consultant_name"],
  ),
  tpl(
    "fissa_meet",
    "MARKETING",
    `Gentile {{lead_name}}, riusciamo a fissare insieme la Sua analisi tecnica gratuita? Mi indichi pure un giorno e un orario di Sua preferenza.${FIRMA}`,
    ["lead_name", "consultant_name"],
  ),
  tpl(
    "no_show_recover",
    "UTILITY",
    `Gentile {{lead_name}}, oggi non siamo riusciti a collegarci come previsto. Possiamo riprogrammare? Mi indichi pure un nuovo orario di Suo gradimento.${FIRMA}`,
    ["lead_name", "consultant_name"],
  ),
  tpl(
    "ringraziamento_neutro",
    "UTILITY",
    `Gentile {{lead_name}}, La ringrazio comunque per il Suo tempo.`,
    ["lead_name"],
  ),
  tpl(
    "ringraziamento_finale",
    "UTILITY",
    `Gentile {{lead_name}}, La ringraziamo ancora per averci scelto. Per qualsiasi necessità futura siamo sempre a Sua disposizione.${FIRMA}`,
    ["lead_name", "consultant_name"],
  ),
  tpl(
    "promemoria_meet",
    "UTILITY",
    `Gentile {{lead_name}},\n\nLe ricordo che il nostro appuntamento è confermato per il {{appointment_date}} alle ore {{appointment_time}}.\n\nLink per collegarsi: {{meet_link}}\n\nLe chiediamo cortesemente di trovarsi in un luogo tranquillo, con una buona connessione internet e con Sua moglie/compagno se possibile.${FIRMA}`,
    ["lead_name", "appointment_date", "appointment_time", "meet_link", "consultant_name"],
  ),
  //  ⚠️ LA CONFERMA AUTOMATICA DELLA CONSULENZA (commessa 2026-10-22): la
  //   manda il cron, una volta sola, subito dopo la prenotazione. Testo
  //   volutamente neutro: niente «gratuita», «offerta», capelli o prezzi —
  //   Meta riclassificherebbe MARKETING, e non è un messaggio sanitario. Se
  //   Meta chiede di cambiarlo, si cambia qui e si rifà la prova.
  tpl(
    "consulenza_conferma_presenza",
    "UTILITY",
    `Gentile {{lead_name}}, la Sua consulenza con Hair Genius Labs è fissata per {{appointment_day}} alle ore {{appointment_time}}.\n\nPer collegarsi: {{meet_link}}\n\nPer confermare la Sua presenza risponda SÌ a questo messaggio.\n\nHair Genius Labs`,
    ["lead_name", "appointment_day", "appointment_time", "meet_link"],
  ),
];

/** ── I MODELLI DI MANYCHAT (commessa 2026-10-25) ──────────────────────────
 *  Gli stessi testi approvati in ManyChat (MODELLI-MANYCHAT.md), con le
 *  variabili nell'ordine dei campi `crm_v1…crm_v4`. Il CRM li manda da solo
 *  (giro, sequenze, messaggi per stato); qui servono a «Prova i modelli».
 *  ⚠️ Non stanno in META_TEMPLATES: quella lista è dei modelli della Cloud API
 *   (Contatti WhatsApp, esportazione per Meta) e non va toccata. */
export const MODELLI_MANYCHAT: MetaTemplate[] = [
  tpl(
    "hgl_primo_contatto",
    "UTILITY",
    `Buongiorno {{lead_name}}, abbiamo ricevuto la sua richiesta di informazioni a Hair Genius Labs. Per gestirla ci serve sapere quando contattarla: preferisce la mattina o la sera?`,
    ["lead_name"],
  ),
  tpl(
    "hgl_primo_contatto_tre_fasce",
    "UTILITY",
    `Gentile {{lead_name}}, la sua richiesta di informazioni a Hair Genius Labs è stata registrata. Per programmare la chiamata di risposta, indichi la fascia oraria in cui è reperibile: mattina, pomeriggio o sera.`,
    ["lead_name"],
  ),
  tpl(
    "hgl_richiamo_24h",
    "UTILITY",
    `Buongiorno {{lead_name}}, la sua richiesta di informazioni è ancora aperta. Per completarla ci indichi se preferisce essere contattato la mattina o la sera.`,
    ["lead_name"],
  ),
  tpl(
    "hgl_ritorno",
    "UTILITY",
    `Buongiorno {{lead_name}}, abbiamo ricevuto il suo nuovo messaggio. Per riprendere la sua richiesta ci dice se preferisce essere contattato la mattina o la sera?`,
    ["lead_name"],
  ),
  tpl(
    "hgl_casi_reali",
    "MARKETING",
    `{{lead_name}}, le lascio qui alcuni casi reali dei nostri clienti, con foto e video. Come vedrà, il nostro non è la classica patch cutanea: è l'Invisible Derm Protocol, su misura. Siamo a Roma e facciamo tutto in giornata, in meno di 2 ore: per questo vengono da noi da tutta Europa.`,
    ["lead_name"],
  ),
  //  Il giorno prima COME MODELLO Utility (nuova versione, 30/10/2026): parte solo se la
  //  consulenza è stata fissata da oltre 3 giorni (`MEET_DOMANI_A_PAGAMENTO_OLTRE_GIORNI`).
  tpl(
    "hgl_meet_domani",
    "UTILITY",
    `Ciao {{lead_name}}, promemoria del tuo appuntamento: consulenza online domani, {{appointment_day}}, alle {{appointment_time}} con {{consultant_name}}.\n\nIl link per collegarti ti arriva domattina. Se non puoi esserci, rispondi qui e lo spostiamo.`,
    ["lead_name", "appointment_day", "appointment_time", "consultant_name"],
  ),
  //  Il giorno prima SOLO COME TESTO, dentro le 24 ore (30/10/2026, `MEET_DOMANI_SOLO_GRATIS`):
  //  NON è un modello Meta e non ha un flusso in ManyChat. Il nome separato lascia
  //  `hgl_meet_domani` identico al testo approvato (la chat lo propone a finestra chiusa). La
  //  domanda finale chiede una risposta breve, che riapre la finestra e fa partire gratis
  //  anche il messaggio del mattino dopo.
  tpl(
    "hgl_meet_domani_testo",
    "UTILITY",
    `Ciao {{lead_name}}, ti ricordo la consulenza online di domani, {{appointment_day}}, alle {{appointment_time}} con {{consultant_name}}. Mi confermi con un ok?`,
    ["lead_name", "appointment_day", "appointment_time", "consultant_name"],
  ),
  tpl(
    "hgl_meet_oggi",
    "UTILITY",
    `Ciao {{lead_name}}, ti ricordo che oggi alle ore {{appointment_time}} hai la tua consulenza online con Hair Genius Labs.\n\nTi seguirà {{consultant_name}}. Poco prima dell'inizio ti arriva il link per collegarti.\n\nSe hai un imprevisto, rispondi qui e troviamo un altro orario.`,
    ["lead_name", "appointment_time", "consultant_name"],
  ),
  //  La mattina del meet COL LINK (modello Meta hgl_meet_oggi_v5, 30/10/2026). Il testo deve
  //  essere IDENTICO a quello approvato: la chat lo manda anche come testo libero.
  tpl(
    "hgl_meet_oggi_link",
    "UTILITY",
    `Ciao {{lead_name}}, ci vediamo oggi alle {{appointment_time}} per la tua consulenza online con {{consultant_name}}.\n\nIl link per collegarti è questo: {{meet_link}}\nPoco prima te lo ricordo qui.`,
    ["lead_name", "appointment_time", "consultant_name", "meet_link"],
  ),
  tpl(
    "hgl_promemoria_meet",
    "UTILITY",
    `Ciao {{lead_name}}, ti ricordo la tua consulenza online con Hair Genius Labs di oggi alle ore {{appointment_time}}, tra circa 20 minuti.\n\nPer collegarti: {{meet_link}}\n\nTi seguirà {{consultant_name}}. Se puoi, collegati da un posto tranquillo e con una buona connessione.\n\nHair Genius Labs`,
    ["lead_name", "appointment_time", "meet_link", "consultant_name"],
  ),
  tpl(
    "hgl_meet_adesso",
    "UTILITY",
    `Ciao {{lead_name}}, la tua consulenza con Hair Genius Labs inizia adesso e {{consultant_name}} ti sta aspettando.\n\nEntra da qui: {{meet_link}}\n\nSe hai difficoltà a collegarti, rispondi a questo messaggio.`,
    ["lead_name", "consultant_name", "meet_link"],
  ),
  tpl(
    "hgl_ricontatto_consulenza",
    "UTILITY",
    `Ciao {{lead_name}}, sono {{consultant_name}}. Ti scrivo per la consulenza che abbiamo fatto insieme: hai domande sulla soluzione di cui abbiamo parlato?`,
    ["lead_name", "consultant_name"],
  ),
  tpl(
    "hgl_meet_da_fissare",
    "UTILITY",
    `Buongiorno {{lead_name}}, sono {{consultant_name}}. Per fissare la data della sua consulenza ci indica se preferisce la mattina o la sera?`,
    ["lead_name", "consultant_name"],
  ),
  tpl(
    "hgl_richiamo_concordato",
    "UTILITY",
    `Ciao {{lead_name}}, come d'accordo ti chiamiamo oggi alle ore {{recontact_time}} da Hair Genius Labs.\n\nSe l'orario non ti va più bene, rispondi qui e lo spostiamo.`,
    ["lead_name", "recontact_time"],
  ),
  tpl(
    "hgl_non_risponde",
    "UTILITY",
    `Gentile {{lead_name}}, abbiamo provato a chiamarLa da Hair Genius Labs per la Sua richiesta di informazioni, senza riuscire a raggiungerLa.\n\nCi indica qui un momento comodo per sentirci? Va bene anche un orario serale.`,
    ["lead_name"],
  ),
  tpl(
    "hgl_cliente_assente",
    "UTILITY",
    `Ciao {{lead_name}}, oggi non siamo riusciti a vederci per la tua consulenza online con Hair Genius Labs.\n\nNessun problema: rispondi qui e ti proponiamo un nuovo orario, mattina o sera come preferisci.`,
    ["lead_name"],
  ),
  tpl(
    "hgl_da_riprogrammare",
    "UTILITY",
    `Buongiorno {{lead_name}}, la sua consulenza va riprogrammata. Ci indica il giorno e l'orario che preferisce?`,
    ["lead_name", "consultant_name"],
  ),
  tpl(
    "hgl_promemoria_sede",
    "UTILITY",
    `Ciao {{lead_name}}, ti ricordo l'appuntamento in sede con Hair Genius Labs di {{appointment_day}} alle ore {{visit_time}}.\n\nIndirizzo: {{address}}\n\nSe hai un imprevisto, rispondi qui e troviamo un altro orario.`,
    ["lead_name", "appointment_day", "visit_time", "address"],
  ),
  tpl(
    "hgl_sede_disdetta",
    "UTILITY",
    `Ciao {{lead_name}}, abbiamo registrato la disdetta del tuo appuntamento in sede con Hair Genius Labs.\n\nQuando vuoi, rispondi qui e fissiamo una nuova data.`,
    ["lead_name"],
  ),
  tpl(
    "hgl_ultimo_tentativo",
    "UTILITY",
    `Buongiorno {{lead_name}}, non avendo ricevuto risposta, chiudiamo la sua richiesta di informazioni. Se vuole riaprirla, ci risponda qui.`,
    ["lead_name"],
  ),
  //  Acconto (commessa 2026-10-29): parte il giorno della data di ricontatto di
  //  «Attesa acconto». Tono del «tu», come i ricontatti: in consulenza si è
  //  entrati in confidenza. Ora UTILITY (modello hgl_acconto_u, 30/10).
  tpl(
    "hgl_acconto",
    "UTILITY",
    `Ciao {{lead_name}}, ti scrivo per l'acconto della soluzione concordata con {{consultant_name}}. Ti mando qui i dati per il versamento?`,
    ["lead_name", "consultant_name"],
  ),
  //  Nuovo (30/10/2026): modello Utility «_u» di ManyChat. Il testo usa solo il nome; il consulente
  //  resta tra i parametri perché il giro lo passa (v2 = consulente) e ManyChat si aspetta due variabili.
  tpl(
    "hgl_come_eravamo_rimasti",
    "UTILITY",
    `Buongiorno {{lead_name}}, la sua richiesta di informazioni è ancora in sospeso. Ci indica quando possiamo ricontattarla?`,
    ["lead_name", "consultant_name"],
  ),
];

/** (30/10/2026) Modelli di commesse recenti, ANCORA DA FAR APPROVARE: stanno fuori da
 *  `MODELLI_MANYCHAT` (che è l'elenco dei modelli già approvati e con flusso, provato a
 *  parte) ma `findMetaTemplate` li trova, così dentro le 24 ore il loro testo parte normale. */
export const MODELLI_DA_APPROVARE: MetaTemplate[] = [
  //  (30/10/2026) Dopo l'acconto: i dati per la fattura. Da far approvare (Utility) e da
  //  collegare a un flusso ManyChat con lo stesso nome. Dentro le 24 ore parte come testo normale.
  tpl(
    "hgl_dati_fattura",
    "UTILITY",
    `Ciao {{lead_name}}, abbiamo ricevuto il tuo acconto, grazie!\n\nPer preparare la fattura ci servono questi dati: nome e cognome (o ragione sociale), codice fiscale o partita IVA, indirizzo completo con CAP e città, ed eventuale PEC o codice SDI.\n\nPuoi scriverli qui, oppure mandarci una foto della carta d'identità o della tessera sanitaria: i dati li leggiamo noi.\n\nHair Genius Labs`,
    ["lead_name"],
  ),
];

/** ── I MODELLI NUOVI «_311026» (31/10/2026) ───────────────────────────────────
 *  Richiesta del titolare: una copia di OGNI modello, con un nome nuovo che finisce con la data
 *  e un testo da UTILITY (Meta li approva così e costano meno), da far approvare PRIMA di usarli.
 *  I vecchi restano nel codice e continuano a partire: i nuovi entrano solo quando si accende
 *  l'interruttore (riga `modelli_utility_311026` in `app_config`, spenta di serie, nessuna
 *  migrazione). Allora la porta (`porta.ts`) manda il nuovo al posto del vecchio, con i parametri
 *  convertiti qui sotto. Quando Meta li ha approvati e tutto va, i vecchi si cancellano a mano.
 *
 *  Regole di scrittura (categoria Utility di Meta):
 *   · il messaggio riguarda una richiesta o un servizio GIÀ chiesto dal cliente: la consulenza
 *     fissata, il promemoria, l'acconto versato, i dati per la fattura;
 *   · niente promozioni, sconti, aggettivi di vendita, inviti a comprare (lista nera provata in
 *     `prove/manychat/modelli-utility.mjs`);
 *   · saluto, riga vuota, l'informazione, riga vuota, chiusura breve con la firma;
 *   · variabili solo quelle del testo, e MAI il link nudo: i modelli col link del meet portano
 *     l'immagine in testa e il pulsante «Entra nella consulenza» (indirizzo con parte variabile).
 *  ⚠️ I due che restano MARKETING (`hgl_casi_reali`, `follow_up_valutazione`) sono segnalati nel
 *   documento per il titolare: un testo che vuole convincere non diventa Utility cambiando le
 *   parole, e Meta lo riclassificherebbe comunque.
 *  ⚠️ `hgl_meet_domani_testo` non ha un nuovo: non è un modello Meta, è il testo libero dentro le
 *   24 ore.
 *  ⚠️ PERCHÉ NON SI PERDE MAI UN INVIO: con l'interruttore acceso, se il nuovo non si può mandare
 *   (flusso non collegato, link non convertibile, più di 4 campi, immagine non ancora data, e sulla
 *   Cloud API Meta che risponde 132001/132015/132016) parte il vecchio e il registro dice il codice
 *   (`modelli311026_ripiego_…`, `modelli311026_cloud_…`).
 *  ── DA TOGLIERE QUANDO SI CANCELLANO I VECCHI MODELLI (e il ramo resta solo coi nuovi) ──────────
 *   · qui: `MODELLI_UTILITY_311026`, `NOME_NUOVO_311026`, `CHIAVE_INTERRUTTORE_311026`,
 *     `interruttoreAcceso`, `suffissoMeetly`, `convertiModelloUtility`, `IMMAGINE_MODELLI*` e la riga
 *     in `findMetaTemplate`; i vecchi nomi si sostituiscono coi nuovi nei file che li citano;
 *   · `porta.ts`: `modelloDaMandare`, `flussoDi`, il ripiego di `viaCloud`, `modelliUtility`,
 *     `avviso` e `immaginiModelli` di `PortePorta`;  `porta.server.ts`: le due porte omonime;
 *   · `vista-pannello.ts`: `MODELLI_FLUSSO_UTILITY_311026`; `ManychatPannello.tsx`: la sezione
 *     «Modelli nuovi (_311026)»;
 *   · prove: `prove/manychat/modelli-utility.mjs` e le due righe in `prove/manychat.mjs`;
 *   · dati: la riga `modelli_utility_311026` in `app_config`. */

/** L'immagine in testa ai modelli Utility col link: un file SOLO MARCHIO «Hair Genius Labs», senza frasi
 *  di vendita, che DEVE DARE IL TITOLARE (1200×630 circa, JPG sotto 1 MB) e che va messo in
 *  `public/modelli-header.jpg`. Non la scheda di Meetly (`anteprima-predefinita.jpg`): ha scritto
 *  «GRATUITA» e «Nessun impegno», e Meta riclasserebbe il modello come Marketing.
 *  ⚠️ Finché il file non c'è, `IMMAGINE_MODELLI_PRONTA` resta `false` e i modelli con l'immagine NON
 *   si usano: la conversione dice «ripiego: immagine» e parte il vecchio (come un flusso mancante).
 *   Quando il file arriva: si mette in `public/`, si porta la bandiera a `true` (la prova controlla
 *   che dica il vero). */
export const IMMAGINE_MODELLI_PRONTA = false;
const IMMAGINE_MODELLI = {
  tipo: "IMAGE" as const,
  file: "public/modelli-header.jpg",
  url: `${SITO}/modelli-header.jpg`,
  pronta: IMMAGINE_MODELLI_PRONTA,
};

/** L'immagine dei casi clienti (MARKETING, come il vecchio): lì la scheda di Meetly va bene. */
const IMMAGINE_CASI = {
  tipo: "IMAGE" as const,
  file: "public/anteprima-predefinita.jpg",
  url: `${SITO}/anteprima-predefinita.jpg`,
  pronta: true,
};

/** Il pulsante dei modelli col link del meet: la parte dopo `/meetly/` è variabile ({{1}} del pulsante). */
const PULSANTE_ENTRA = {
  testo: "Entra nella consulenza",
  url: `${SITO}/meetly/{{1}}`,
  da: "meet_link" as const,
  esempio: "abc-defg-hij?chi=p1a2b3c",
};

const SALUTO_LEI = "Gentile {{lead_name}},\n\n";
const SALUTO_BUONGIORNO = "Buongiorno {{lead_name}},\n\n";
const SALUTO_TU = "Ciao {{lead_name}},\n\n";
/** Chiusura col nome del consulente (i modelli che lo ricevono) o solo la firma. */
const CHIUSURA_CONSULENTE = "\n\nCordiali saluti,\n{{consultant_name}}\nHair Genius Labs";
const CHIUSURA = "\n\nHair Genius Labs";

function nuovo(
  sostituisce: string,
  name: string,
  category: MetaTemplate["category"],
  body: string,
  keys: ParamKey[],
  extra: Pick<MetaTemplate, "header" | "pulsante"> = {},
): MetaTemplate {
  return tpl(name, category, body, keys, "it", { sostituisce, ...extra });
}

export const MODELLI_UTILITY_311026: MetaTemplate[] = [
  // ── i modelli della Cloud API (Contatti WhatsApp) ──
  nuovo(
    "appuntamento_conferma",
    "conferma_appuntamento_311026",
    "UTILITY",
    `${SALUTO_LEI}Le confermiamo l'appuntamento per la consulenza tecnica prevista: {{appointment_date}} alle ore {{appointment_time}}. Il collegamento Le sarà inviato prima dell'orario.${CHIUSURA_CONSULENTE}`,
    ["lead_name", "appointment_date", "appointment_time", "consultant_name"],
  ),
  nuovo(
    "ringraziamento_vendita",
    "conferma_incarico_311026",
    "UTILITY",
    `${SALUTO_LEI}Le confermiamo di aver registrato il Suo incarico per l'installazione. A breve La contatteremo per concordare data e modalità dell'intervento.${CHIUSURA_CONSULENTE}`,
    ["lead_name", "consultant_name"],
  ),
  nuovo(
    "acconto_ricevuto",
    "acconto_registrato_311026",
    "UTILITY",
    `${SALUTO_LEI}Le confermiamo di aver ricevuto il Suo acconto. Procediamo con l'ordine relativo alla Sua installazione e La aggiorneremo sulle tempistiche.${CHIUSURA_CONSULENTE}`,
    ["lead_name", "consultant_name"],
  ),
  nuovo(
    "promemoria_acconto",
    "acconto_da_versare_311026",
    "UTILITY",
    `${SALUTO_LEI}Le ricordiamo che, per bloccare la data della Sua installazione, risulta ancora da versare l'acconto concordato. Per qualsiasi chiarimento può rispondere a questo messaggio.${CHIUSURA_CONSULENTE}`,
    ["lead_name", "consultant_name"],
  ),
  nuovo(
    "conferma_sede",
    "appuntamento_in_sede_311026",
    "UTILITY",
    `${SALUTO_LEI}Le confermiamo l'appuntamento presso la nostra sede il giorno {{visit_date}} alle ore {{visit_time}}.\nIndirizzo: Via degli Scipioni 132, Roma.\nPer qualsiasi necessità può rispondere a questo messaggio.${CHIUSURA_CONSULENTE}`,
    ["lead_name", "visit_date", "visit_time", "consultant_name"],
  ),
  nuovo(
    "gestire_in_chat",
    "assistenza_in_chat_311026",
    "UTILITY",
    `${SALUTO_LEI}Per la Sua richiesta può scriverci direttamente in questa chat. Le risponderemo personalmente, nel più breve tempo possibile.${CHIUSURA_CONSULENTE}`,
    ["lead_name", "consultant_name"],
  ),
  //  Resta MARKETING: chiede se il cliente ha deciso sulla proposta, cioè spinge all'acquisto.
  nuovo(
    "follow_up_valutazione",
    "verifica_proposta_311026",
    "MARKETING",
    `${SALUTO_LEI}La contatto per sapere se ha avuto modo di valutare la proposta che Le abbiamo inviato. Per qualsiasi dubbio può rispondere a questo messaggio.${CHIUSURA_CONSULENTE}`,
    ["lead_name", "consultant_name"],
  ),
  nuovo(
    "promemoria_ricontatto",
    "ricontatto_concordato_311026",
    "UTILITY",
    `${SALUTO_LEI}Come concordato, La ricontatteremo il {{recontact_date}} alle ore {{recontact_time}}. Se l'orario non fosse più adatto, può rispondere a questo messaggio per indicarcene un altro.${CHIUSURA_CONSULENTE}`,
    ["lead_name", "recontact_date", "recontact_time", "consultant_name"],
  ),
  //  Era MARKETING («analisi tecnica gratuita»). Senza l'offerta, e riferito alla consulenza di cui
  //  si è parlato, è un messaggio di servizio: come `hgl_meet_da_fissare`, già Utility. ⚠️ NIENTE
  //  «che ci ha richiesto»: i lead richiamati da un consulente (`fissa_meet_dopo`) non l'hanno chiesta.
  //  Meta può comunque riclassificarlo.
  nuovo(
    "fissa_meet",
    "consulenza_da_fissare_311026",
    "UTILITY",
    `${SALUTO_LEI}Per fissare la consulenza di cui abbiamo parlato, ci indichi il giorno e l'orario in cui è disponibile. Confermeremo la data in questa chat.${CHIUSURA_CONSULENTE}`,
    ["lead_name", "consultant_name"],
  ),
  nuovo(
    "no_show_recover",
    "consulenza_non_avvenuta_311026",
    "UTILITY",
    `${SALUTO_LEI}Oggi non è stato possibile collegarci per la consulenza prevista. Ci indichi un nuovo giorno e orario in cui riprogrammarla: confermeremo la nuova data.${CHIUSURA_CONSULENTE}`,
    ["lead_name", "consultant_name"],
  ),
  nuovo(
    "ringraziamento_neutro",
    "chiusura_richiesta_311026",
    "UTILITY",
    `${SALUTO_LEI}La informiamo che la Sua richiesta risulta chiusa. La ringraziamo per il tempo dedicato: per riaprirla può rispondere a questo messaggio.${CHIUSURA}`,
    ["lead_name"],
  ),
  nuovo(
    "ringraziamento_finale",
    "servizio_concluso_311026",
    "UTILITY",
    `${SALUTO_LEI}Le confermiamo che l'intervento richiesto risulta concluso. Per qualsiasi necessità legata al servizio può rispondere a questo messaggio.${CHIUSURA_CONSULENTE}`,
    ["lead_name", "consultant_name"],
  ),
  //  Col link: immagine in testa e pulsante. Tolta la frase «con Sua moglie/compagno».
  nuovo(
    "promemoria_meet",
    "promemoria_collegamento_311026",
    "UTILITY",
    `${SALUTO_LEI}Le ricordiamo che la Sua consulenza online è confermata per il {{appointment_date}} alle ore {{appointment_time}}.\nPer collegarsi usi il pulsante «Entra nella consulenza» qui sotto: Le consigliamo un luogo tranquillo e una buona connessione internet.${CHIUSURA_CONSULENTE}`,
    ["lead_name", "appointment_date", "appointment_time", "consultant_name"],
    { header: IMMAGINE_MODELLI, pulsante: PULSANTE_ENTRA },
  ),
  //  La conferma automatica (cron del 22/10): testo neutro, vedi il commento del modello vecchio.
  nuovo(
    "consulenza_conferma_presenza",
    "conferma_consulenza_online_311026",
    "UTILITY",
    `${SALUTO_LEI}La Sua consulenza online con Hair Genius Labs è fissata per {{appointment_day}} alle ore {{appointment_time}}.\n\nPer collegarsi usi il pulsante «Entra nella consulenza» qui sotto. Per confermare la Sua presenza risponda SÌ a questo messaggio.${CHIUSURA}`,
    ["lead_name", "appointment_day", "appointment_time"],
    { header: IMMAGINE_MODELLI, pulsante: PULSANTE_ENTRA },
  ),

  // ── i modelli di ManyChat ──
  nuovo(
    "hgl_primo_contatto",
    "hgl_richiesta_ricevuta_311026",
    "UTILITY",
    `${SALUTO_BUONGIORNO}Abbiamo ricevuto la sua richiesta di informazioni a Hair Genius Labs. Per gestirla ci serve sapere quando contattarla: preferisce la mattina o la sera?${CHIUSURA}`,
    ["lead_name"],
  ),
  nuovo(
    "hgl_primo_contatto_tre_fasce",
    "hgl_richiesta_fascia_oraria_311026",
    "UTILITY",
    `${SALUTO_LEI}La sua richiesta di informazioni a Hair Genius Labs è stata registrata. Per programmare la chiamata di risposta, indichi la fascia oraria in cui è reperibile: mattina, pomeriggio o sera.${CHIUSURA}`,
    ["lead_name"],
  ),
  nuovo(
    "hgl_richiamo_24h",
    "hgl_richiesta_aperta_311026",
    "UTILITY",
    `${SALUTO_BUONGIORNO}La sua richiesta di informazioni a Hair Genius Labs risulta registrata e ancora aperta. Per proseguire ci serve sapere se preferisce essere contattato la mattina o la sera.${CHIUSURA}`,
    ["lead_name"],
  ),
  nuovo(
    "hgl_ritorno",
    "hgl_nuovo_messaggio_ricevuto_311026",
    "UTILITY",
    `${SALUTO_BUONGIORNO}Abbiamo ricevuto il suo nuovo messaggio. Per riprendere la sua richiesta ci indichi se preferisce essere contattato la mattina o la sera.${CHIUSURA}`,
    ["lead_name"],
  ),
  //  Resta MARKETING: foto e video di lavori già fatti sono contenuto di presentazione. Il testo è
  //  ripulito dalle frasi di vendita (nome del protocollo, «meno di 2 ore», «da tutta Europa»).
  //  Come il vecchio: immagine in testa e pulsante con l'indirizzo fisso della pagina dei media.
  nuovo(
    "hgl_casi_reali",
    "hgl_esempi_lavori_311026",
    "MARKETING",
    `${SALUTO_BUONGIORNO}Qui trova alcuni esempi di lavori già realizzati, con foto e video, relativi alla soluzione su cui ha chiesto informazioni.${CHIUSURA}`,
    ["lead_name"],
    {
      header: IMMAGINE_CASI,
      pulsante: { testo: "Vedi gli esempi", url: `${SITO}/media/DPKW-3JHV-RC77` },
    },
  ),
  nuovo(
    "hgl_meet_domani",
    "hgl_consulenza_domani_311026",
    "UTILITY",
    `${SALUTO_TU}Ti ricordiamo la tua consulenza online di domani, {{appointment_day}}, alle ore {{appointment_time}} con {{consultant_name}}.\nIl link per collegarti ti arriva domattina. Se non puoi esserci, rispondi qui e la spostiamo.${CHIUSURA}`,
    ["lead_name", "appointment_day", "appointment_time", "consultant_name"],
  ),
  nuovo(
    "hgl_meet_oggi",
    "hgl_consulenza_oggi_311026",
    "UTILITY",
    `${SALUTO_TU}Ti ricordiamo che oggi alle ore {{appointment_time}} hai la tua consulenza online con Hair Genius Labs, con {{consultant_name}}. Poco prima dell'inizio ti arriva il link per collegarti.\nSe hai un imprevisto, rispondi qui e troviamo un altro orario.${CHIUSURA}`,
    ["lead_name", "appointment_time", "consultant_name"],
  ),
  nuovo(
    "hgl_meet_oggi_link",
    "hgl_consulenza_oggi_con_link_311026",
    "UTILITY",
    `${SALUTO_TU}Ti ricordiamo che oggi alle ore {{appointment_time}} hai la tua consulenza online con {{consultant_name}}.\nPer collegarti usa il pulsante «Entra nella consulenza» qui sotto. Poco prima dell'inizio ti rimandiamo il promemoria.${CHIUSURA}`,
    ["lead_name", "appointment_time", "consultant_name"],
    { header: IMMAGINE_MODELLI, pulsante: PULSANTE_ENTRA },
  ),
  nuovo(
    "hgl_promemoria_meet",
    "hgl_promemoria_consulenza_311026",
    "UTILITY",
    `${SALUTO_TU}La tua consulenza online con Hair Genius Labs inizia oggi alle ore {{appointment_time}}, tra circa 20 minuti, con {{consultant_name}}.\nPer collegarti usa il pulsante «Entra nella consulenza» qui sotto. Se puoi, collegati da un posto tranquillo e con una buona connessione.${CHIUSURA}`,
    ["lead_name", "appointment_time", "consultant_name"],
    { header: IMMAGINE_MODELLI, pulsante: PULSANTE_ENTRA },
  ),
  nuovo(
    "hgl_meet_adesso",
    "hgl_consulenza_in_corso_311026",
    "UTILITY",
    `${SALUTO_TU}La tua consulenza con Hair Genius Labs sta iniziando e {{consultant_name}} ti sta aspettando.\nPer entrare usa il pulsante «Entra nella consulenza» qui sotto. Se hai difficoltà a collegarti, rispondi a questo messaggio.${CHIUSURA}`,
    ["lead_name", "consultant_name"],
    { header: IMMAGINE_MODELLI, pulsante: PULSANTE_ENTRA },
  ),
  nuovo(
    "hgl_ricontatto_consulenza",
    "hgl_seguito_consulenza_311026",
    "UTILITY",
    `${SALUTO_TU}Sono {{consultant_name}} di Hair Genius Labs. La consulenza svolta insieme risulta registrata: per un chiarimento su quanto ci siamo detti puoi rispondere a questo messaggio.${CHIUSURA}`,
    ["lead_name", "consultant_name"],
  ),
  nuovo(
    "hgl_meet_da_fissare",
    "hgl_data_consulenza_311026",
    "UTILITY",
    `${SALUTO_BUONGIORNO}Sono {{consultant_name}} di Hair Genius Labs. Per fissare la data della consulenza ci indichi se preferisce la mattina o la sera.${CHIUSURA}`,
    ["lead_name", "consultant_name"],
  ),
  nuovo(
    "hgl_richiamo_concordato",
    "hgl_chiamata_concordata_311026",
    "UTILITY",
    `${SALUTO_TU}Come d'accordo, oggi alle ore {{recontact_time}} ti chiamiamo da Hair Genius Labs. Se l'orario non ti va più bene, rispondi qui e lo spostiamo.${CHIUSURA}`,
    ["lead_name", "recontact_time"],
  ),
  nuovo(
    "hgl_non_risponde",
    "hgl_chiamata_senza_risposta_311026",
    "UTILITY",
    `${SALUTO_LEI}Abbiamo provato a chiamarLa da Hair Genius Labs per la Sua richiesta di informazioni, senza riuscire a raggiungerLa. Ci indichi qui un momento comodo per sentirci: va bene anche un orario serale.${CHIUSURA}`,
    ["lead_name"],
  ),
  nuovo(
    "hgl_cliente_assente",
    "hgl_consulenza_mancata_311026",
    "UTILITY",
    `${SALUTO_TU}Oggi non siamo riusciti a vederci per la tua consulenza online con Hair Genius Labs. Rispondi qui indicando se preferisci la mattina o la sera: ti proponiamo un nuovo orario.${CHIUSURA}`,
    ["lead_name"],
  ),
  nuovo(
    "hgl_da_riprogrammare",
    "hgl_nuova_data_consulenza_311026",
    "UTILITY",
    `${SALUTO_BUONGIORNO}La sua consulenza deve essere riprogrammata. Ci indichi il giorno e l'orario che preferisce: confermeremo la nuova data.${CHIUSURA_CONSULENTE}`,
    ["lead_name", "consultant_name"],
  ),
  nuovo(
    "hgl_promemoria_sede",
    "hgl_appuntamento_sede_311026",
    "UTILITY",
    `${SALUTO_TU}Ti ricordiamo l'appuntamento in sede con Hair Genius Labs di {{appointment_day}} alle ore {{visit_time}}.\nIndirizzo: {{address}}\nSe hai un imprevisto, rispondi qui e troviamo un altro orario.${CHIUSURA}`,
    ["lead_name", "appointment_day", "visit_time", "address"],
  ),
  nuovo(
    "hgl_sede_disdetta",
    "hgl_disdetta_sede_registrata_311026",
    "UTILITY",
    `${SALUTO_TU}Abbiamo registrato la disdetta del tuo appuntamento in sede con Hair Genius Labs. Quando vuoi, rispondi qui e fissiamo una nuova data.${CHIUSURA}`,
    ["lead_name"],
  ),
  nuovo(
    "hgl_ultimo_tentativo",
    "hgl_richiesta_chiusa_311026",
    "UTILITY",
    `${SALUTO_BUONGIORNO}Non avendo ricevuto risposta, abbiamo chiuso la sua richiesta di informazioni. Se vuole riaprirla, ci risponda qui.${CHIUSURA}`,
    ["lead_name"],
  ),
  nuovo(
    "hgl_acconto",
    "hgl_dati_versamento_311026",
    "UTILITY",
    `${SALUTO_TU}Ti scrivo per l'acconto relativo alla soluzione concordata con {{consultant_name}}. Se vuoi, rispondi qui e ti mandiamo i dati per il versamento.${CHIUSURA}`,
    ["lead_name", "consultant_name"],
  ),
  nuovo(
    "hgl_come_eravamo_rimasti",
    "hgl_richiesta_in_sospeso_311026",
    "UTILITY",
    `${SALUTO_BUONGIORNO}La sua richiesta di informazioni a Hair Genius Labs è registrata e in attesa del nostro contatto. Per procedere ci indichi quando possiamo chiamarla.${CHIUSURA}`,
    ["lead_name"],
  ),

  // ── il modello dei dati per la fattura (già in `MODELLI_DA_APPROVARE`) ──
  //  ⚠️ Nel modello niente codice fiscale, partita IVA né documenti: Meta non li ammette. L'elenco
  //  dei dati si manda dopo come testo libero: la risposta del cliente apre le 24 ore.
  nuovo(
    "hgl_dati_fattura",
    "hgl_dati_per_fattura_311026",
    "UTILITY",
    `${SALUTO_TU}Abbiamo ricevuto il tuo acconto. Per preparare la fattura ci servono i tuoi dati di fatturazione: rispondi a questo messaggio e ti indichiamo come inviarli.${CHIUSURA}`,
    ["lead_name"],
  ),
];

/** Vecchio nome → nome nuovo. */
export const NOME_NUOVO_311026: Record<string, string> = Object.fromEntries(
  MODELLI_UTILITY_311026.map((t) => [t.sostituisce as string, t.name]),
);

/** La riga di `app_config` che accende i modelli nuovi. Senza la riga (o con un valore che non
 *  sia «on») restano i vecchi: spento di serie, nessuna migrazione. */
export const CHIAVE_INTERRUTTORE_311026 = "modelli_utility_311026";

/** Il valore della riga dice «acceso»? Qualunque altra cosa (vuoto, «off», un refuso) è spento. */
export function interruttoreAcceso(valore: unknown): boolean {
  return ["on", "true", "1", "si", "sì"].includes(
    String(valore ?? "")
      .trim()
      .toLowerCase(),
  );
}

/** La parte variabile del pulsante «Entra nella consulenza»: quello che sta dopo
 *  `https://hair-genius-hub.hair/meetly/` nel link personale (codice della stanza e gettone di chi
 *  lo riceve, es. `kfr-mbqd-tzp?chi=pAbC12`). `null` se il link non è una stanza nostra: allora
 *  il modello nuovo non si può mandare e parte il vecchio, col link nel testo. */
export function suffissoMeetly(link: string | null | undefined): string | null {
  const l = String(link ?? "").trim();
  const base = `${SITO}/meetly/`;
  if (!l.startsWith(base)) return null;
  const resto = l.slice(base.length);
  return resto && !/[\s#]/.test(resto) ? resto : null;
}

/** Perché il nuovo non si può mandare (e parte il vecchio): `valori` = manca un valore, `link` = non è
 *  una stanza nostra, `immagine` = il titolare non ha ancora dato l'immagine. */
export type RipiegoModello = { ripiego: "valori" | "link" | "immagine" };

/** I parametri del vecchio modello, convertiti per il nuovo: i valori del testo (per chiave, non
 *  per posizione) e, se il nuovo ha il pulsante, la parte variabile del link in coda.
 *  `null` se il vecchio non ha un nuovo (niente da fare: non è un ripiego). Se il nuovo c'è ma non si
 *  può mandare, `{ ripiego }` col motivo: chi chiama manda il vecchio e lo scrive nel registro.
 *  `opzioni.immagini` forza lo stato dell'immagine (solo per le prove). */
export function convertiModelloUtility(
  nome: string,
  parametri: string[],
  opzioni: { immagini?: boolean } = {},
): { modello: string; parametri: string[] } | RipiegoModello | null {
  const nuovoModello = MODELLI_UTILITY_311026.find((t) => t.sostituisce === nome);
  const vecchio = [...META_TEMPLATES, ...MODELLI_MANYCHAT, ...MODELLI_DA_APPROVARE].find(
    (t) => t.name === nome,
  );
  if (!nuovoModello || !vecchio) return null;
  //  Un modello con l'immagine in testa non si usa finché l'immagine non c'è (è come un flusso mancante).
  if (nuovoModello.header && !(opzioni.immagini ?? nuovoModello.header.pronta))
    return { ripiego: "immagine" };
  const valore = (chiave: ParamKey) => {
    const i = vecchio.params.findIndex((p) => p.key === chiave);
    return i < 0 ? "" : String(parametri[i] ?? "").trim();
  };
  const fuori: string[] = [];
  for (const p of nuovoModello.params) {
    const v = valore(p.key);
    if (!v) return { ripiego: "valori" };
    fuori.push(v);
  }
  if (nuovoModello.pulsante?.da) {
    const parte = suffissoMeetly(valore(nuovoModello.pulsante.da));
    if (!parte) return { ripiego: valore(nuovoModello.pulsante.da) ? "link" : "valori" };
    fuori.push(parte);
  }
  return { modello: nuovoModello.name, parametri: fuori };
}

export function findMetaTemplate(name: string): MetaTemplate | undefined {
  return (
    META_TEMPLATES.find((t) => t.name === name) ??
    MODELLI_MANYCHAT.find((t) => t.name === name) ??
    MODELLI_DA_APPROVARE.find((t) => t.name === name) ??
    MODELLI_UTILITY_311026.find((t) => t.name === name)
  );
}

/** Genera il contenuto TXT pronto da copiare/incollare in Meta Business Manager. */
export function buildMetaTemplatesTxt(): string {
  const lines: string[] = [];
  lines.push("===============================================================");
  lines.push("  TEMPLATE WHATSAPP — PRONTI PER META BUSINESS MANAGER");
  lines.push("  Hair Genius Labs · placeholder POSIZIONALI {{1}} {{2}} ...");
  lines.push("===============================================================");
  lines.push("");
  lines.push("ISTRUZIONI:");
  lines.push("1. Vai su https://business.facebook.com/wa/manage/message-templates/");
  lines.push("2. Clicca 'Crea template' per ciascuna voce qui sotto.");
  lines.push("3. Imposta NAME, CATEGORY e LANGUAGE come indicato.");
  lines.push(
    "4. Incolla il BODY: i placeholder {{1}}, {{2}}, ... sono già numerici come richiede Meta.",
  );
  lines.push("5. Aggiungi i SAMPLE VALUES nello stesso ordine indicato.");
  lines.push("");

  META_TEMPLATES.forEach((t, i) => {
    lines.push("---------------------------------------------------------------");
    lines.push(`#${(i + 1).toString().padStart(2, "0")}  ${t.name}`);
    lines.push("---------------------------------------------------------------");
    lines.push(`NAME       : ${t.name}`);
    lines.push(`CATEGORY   : ${t.category}`);
    lines.push(`LANGUAGE   : ${t.language}`);
    lines.push("");
    lines.push("BODY:");
    lines.push(t.body);
    lines.push("");
    if (t.params.length > 0) {
      lines.push("PLACEHOLDERS:");
      t.params.forEach((p) => {
        lines.push(`  {{${p.index}}} = ${p.description}`);
      });
      lines.push("");
      lines.push("SAMPLE VALUES (per la review Meta, in ordine):");
      t.params.forEach((p) => {
        lines.push(`  {{${p.index}}} → ${p.example}`);
      });
      lines.push("");
    } else {
      lines.push("PLACEHOLDERS: nessuno");
      lines.push("");
    }
  });

  lines.push("===============================================================");
  lines.push("  FINE — totale template: " + META_TEMPLATES.length);
  lines.push("===============================================================");
  return lines.join("\n");
}
