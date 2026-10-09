/** ── QUANDO UNA PERSONA RICOMPARE IN UNA LISTA ─────────────────────────────
 *
 *  Richiesta del committente: «quando è duplicato dove va? Voglio che sposta il
 *  lead duplicato dentro la scheda importati, mantenendo stato attuale, note e
 *  tutto, e posso cliccare su conferma e rimane così com'è e torna tra i lead
 *  normali dove stava; oppure un pulsante che lo sposta in “da contattare” in
 *  mezzo agli altri e resetta lo stato, ma aggiunge delle note interne che è
 *  stato duplicato e ci sta scritto anche il numero di volte. Le note sono non
 *  modificabili».
 *
 *  ── COM'ERA, E PERCHÉ SI PERDEVA ─────────────────────────────────────────
 *  Il contatto «di ritorno» veniva riconosciuto al momento della lettura del
 *  file e consegnato alla pagina come un `Set` di id tenuto NELLA SCHERMATA
 *  (`idRitorno` in routes/CRM.importa). Tre conseguenze, tutte invisibili:
 *   · durava quanto una scheda del browser aperta — un F5 e non era mai
 *     successo niente;
 *   · lo vedeva solo chi aveva caricato il file, non il collega;
 *   · e soprattutto: caricando da «Importa lead» (routes/CRM.importa-lead) quel
 *     `Set` veniva buttato via apposta (`onLetti={() => {}}`), perché lì non
 *     c'è nessuna coda da riordinare. Cioè il caso normale — si carica la lista
 *     dalla sua schermata — perdeva i duplicati del tutto: il conto «Di
 *     ritorno: 1» si leggeva nell'anteprima e poi quella persona non compariva
 *     da nessuna parte.
 *
 *  ── DOVE VIVE ADESSO ─────────────────────────────────────────────────────
 *  Su un campo della scheda (`LeadData.ricarico`), scritto quando si importa.
 *  È la stessa scelta dei saltati (crm/importa/saltati.ts) e per le stesse
 *  ragioni, scritte lì per esteso: un elenco di id a parte è un secondo elenco
 *  da tenere allineato al primo, sopravvive alla scheda cancellata e nessuno lo
 *  ripulisce mai. Sulla scheda, invece, il fatto viaggia con la persona.
 *
 *  ── LE NOTE NON SI SCRIVONO: SI CALCOLANO ────────────────────────────────
 *  «Le note sono non modificabili». Il modo più solido di renderle tali non è
 *  un campo protetto — un campo si può sempre scrivere da un'altra schermata —
 *  ma NON AVERE un campo: le righe si compongono da `ricarico` ogni volta che
 *  si guardano (`righeRicarico`). Non esiste un posto dove modificarle, non
 *  possono disallinearsi dal contatore, e non occupano spazio in archivio.
 *  ⚠️ Per questo NON finiscono in `LeadData.note`, che è il diario che le
 *   persone scrivono e riscrivono: mescolarle lì vorrebbe dire una nota
 *   automatica cancellabile con un colpo di tastiera, cioè il contrario di
 *   quello che è stato chiesto.
 *  ───────────────────────────────────────────────────────────────────────── */
import type { Lead, LeadData, LeadStatus, RicaricoLead } from "@/crm/types";
import { LEAD_STATUS_LABEL, eStatoNonSvolta } from "@/crm/types";
//  ⚠️ I TESTI NON STANNO PIÙ QUI: stanno nei modelli, con tutti gli altri
//   messaggi che partono ai clienti, e si modificano dal pannello senza
//   pubblicare niente. Da qui si sceglie soltanto QUALE serve.
import { componiMessaggio, modelloDi, type ChiaveModello } from "@/crm/whatsapp";
//  «Messo da parte» è un gesto sulla telefonata e vive lì: qui serve soltanto
//  a sapere che quella persona è fuori dal giro (vedi `repartoDelRitorno`).
import { eSaltato } from "./saltati";

/** Lo stato in cui torna chi viene rimesso in circolo. Uno solo, scritto qui:
 *  «resetta lo stato» deve voler dire la stessa cosa ovunque lo si legga. */
export const STATO_RIMESSO: LeadStatus = "da_contattare";

const giorno = (iso?: string): string => {
  const d = new Date(String(iso || ""));
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });
};

/** Il ricarico di questa scheda, se c'è ed è leggibile.
 *  ⚠️ Le schede vecchie non hanno il campo, e un archivio importato può avere
 *   qualunque cosa dentro: qui si risponde «non ce n'è» invece di far cadere la
 *   pagina che lo mostra. */
export function ricaricoDi(d?: Partial<LeadData> | null): RicaricoLead | null {
  const r = d?.ricarico;
  if (!r || typeof r !== "object") return null;
  const volte = Number(r.volte);
  if (!Number.isFinite(volte) || volte < 1) return null;
  return { ...r, volte: Math.floor(volte) };
}

/** Quante volte è ricomparsa in una lista. 0 = mai. */
export function volteRicaricato(d?: Partial<LeadData> | null): number {
  return ricaricoDi(d)?.volte ?? 0;
}

/** ── LE TRE RISPOSTE ALLA STESSA DOMANDA ──────────────────────────────────
 *  «Questa persona l'abbiamo già: che ne facciamo?» si può chiudere in tre
 *  modi, e sono quelli chiesti dal committente: confermare, rimetterla fra i
 *  da contattare, oppure — da adesso — rimandare («vedi dopo»).
 *
 *  ⚠️ RIMANDARE NON È DECIDERE, e per questo `daDecidere` resta vero anche
 *   dopo il «vedi dopo»: la domanda è ancora aperta e va ritrovata. Quello che
 *   cambia è DOVE si trova — non più in cima alla coda delle telefonate, dove
 *   interrompeva il giro, ma nella sua linguetta, dove si guardano tutte
 *   insieme con calma.
 *  ⚠️ Le funzioni qui sotto vanno lette insieme, perché è facilissimo usarne
 *   una per l'altra:
 *     · `eDaDecidere`         → «decidi ADESSO» (in cima alla coda, riquadro giallo)
 *     · `eRimandato`          → «decidi quando vuoi» (linguetta «Vedi dopo»)
 *     · `eContattatoWhatsApp` → «gli ho scritto, aspetto risposta»
 *     · `aspettaUnaDecisione` → una qualunque delle tre: la domanda è aperta.
 *  ⚠️ Le tre destinazioni si escludono a vicenda A SCHERMO — una scheda sta in
 *   un elenco solo — ma sono la STESSA domanda in tre momenti diversi, e
 *   nessuna delle tre la chiude. La chiudono soltanto «conferma» e «rimettilo
 *   fra i da contattare». */

/** Chiede una decisione ADESSO: è questo — e non l'essere «di ritorno» — che
 *  la tiene in cima ai «Lead importati». Un contatto confermato resta
 *  ricaricato per sempre nella sua storia, ma non chiede più niente a nessuno.
 *  ⚠️ Chi è stato messo in «Vedi dopo» qui risponde NO: è esattamente ciò che
 *   quel pulsante serve a ottenere. */
export function eDaDecidere(l?: Lead | { data?: Partial<LeadData> | null } | null): boolean {
  const r = ricaricoDi(l?.data);
  return !!r?.daDecidere && !r?.rimandatoIl && !r?.whatsappIl;
}

/** Messo da parte con «Vedi dopo»: la domanda è aperta, ma non adesso.
 *  ⚠️ Chi è stato scritto su WhatsApp esce di qui: il messaggio è più recente
 *   del rinvio, e una scheda in due elenchi è una scheda che si decide due
 *   volte (o nessuna). */
export function eRimandato(l?: Lead | { data?: Partial<LeadData> | null } | null): boolean {
  const r = ricaricoDi(l?.data);
  return !!r?.daDecidere && !!r?.rimandatoIl && !r?.whatsappIl;
}

/** Gli è stato scritto su WhatsApp: la palla è dall'altra parte. */
export function eContattatoWhatsApp(
  l?: Lead | { data?: Partial<LeadData> | null } | null,
): boolean {
  const r = ricaricoDi(l?.data);
  return !!r?.daDecidere && !!r?.whatsappIl;
}

/** ── DA QUANTO ASPETTA UNA RISPOSTA ───────────────────────────────────────
 *
 *  Richiesta del committente: «una volta contattati su WhatsApp devono stare
 *  nel reparto contattati su WhatsApp», e poi — scegliendo fra le tre strade
 *  proposte — «dopo N giorni si vede che è stato dimenticato, ma niente si
 *  muove da solo alle mie spalle».
 *
 *  Il reparto degli scritti è un DEBITO: ogni riga è una persona a cui abbiamo
 *  scritto e che non ha risposto. Finché sono tre righe si guardano; a venti,
 *  quella di sei giorni fa è identica a quella di stamattina — e resta lì per
 *  sempre. Qui si risponde a «da quanto aspetta», e con quale tono dirlo.
 *
 *  ⚠️ NON SPOSTA NIENTE E NON SCRIVE NIENTE: cambia solo il colore della riga.
 *   Una scheda che torna in coda da sola dopo N giorni è una scheda che si
 *   decide due volte — o nessuna — e il committente ha scelto esplicitamente
 *   di non averla.
 *  ⚠️ IL «NON CONFERMATO» È UN'ALTRA COSA, e viaggia insieme: premere il tasto
 *   apre soltanto WhatsApp, la conferma la dà una persona col ✓. Finché non
 *   arriva, la riga lo dice — se no «scritto» e «forse scritto» si leggono
 *   uguali, e chi guarda non sa se può contarci. */
export const ATTESA_AMBRA_GG = 3;
export const ATTESA_ROSSA_GG = 6;

export interface AttesaWhatsApp {
  /** Giorni interi da quando è stato aperto WhatsApp. */
  giorni: number;
  /** Una persona ha confermato col ✓ che il messaggio è partito davvero. */
  confermato: boolean;
  tono: "neutro" | "ambra" | "rosso";
  /** La frase da scrivere sulla riga. Vuota = non c'è niente da dire. */
  testo: string;
}

const GIORNO_MS = 24 * 60 * 60 * 1000;

/** Giorni interi passati da una data. -1 = data illeggibile o assente. */
export function giorniDa(iso?: string | null, adesso: Date = new Date()): number {
  const t = Date.parse(String(iso || ""));
  if (!Number.isFinite(t)) return -1;
  //  ⚠️ Mai negativo: una data nel futuro è l'orologio di un altro computer,
  //   non un'attesa al contrario.
  return Math.max(0, Math.floor((adesso.getTime() - t) / GIORNO_MS));
}

/** Com'è messa l'attesa di questa scheda. `null` = non gli è stato scritto. */
export function attesaWhatsApp(
  l?: Lead | { data?: Partial<LeadData> | null } | null,
  adesso: Date = new Date(),
): AttesaWhatsApp | null {
  const r = ricaricoDi(l?.data);
  if (!r?.whatsappIl) return null;
  const giorni = giorniDa(r.whatsappIl, adesso);
  const confermato = !!r.whatsappConfermatoIl;
  const tono: AttesaWhatsApp["tono"] =
    giorni >= ATTESA_ROSSA_GG ? "rosso" : giorni >= ATTESA_AMBRA_GG ? "ambra" : "neutro";
  const quanto = giorni <= 0 ? "oggi" : giorni === 1 ? "da ieri" : `da ${giorni} giorni`;
  //  ⚠️ Due cose in una frase sola, perché sono due cose che si guardano
  //   insieme: da quanto aspetta, e se quel messaggio è partito davvero.
  const testo = confermato ? `Aspetta risposta ${quanto}` : `Aperto ${quanto}, non confermato`;
  return { giorni, confermato, tono, testo };
}

/** ── «SI FA VIVO LUI» È UN CONTATTO DI RITORNO ────────────────────────────
 *  Richiesta del committente: «tutte le persone di ritorno stanno nel loro
 *  filtro». Di ritorno non è solo chi ricompare in una lista importata: è
 *  anche chi ha detto che richiama lui (lo stato «Ci ricontatta lui»). Sono la
 *  stessa cosa vista da due parti — una persona già passata di qui, su cui la
 *  palla non è più nostra — e vanno guardate nello stesso posto.
 *  ⚠️ NON HA UN `ricarico`: non ricompare da nessuna lista, quindi le due
 *   decisioni del contatto di ritorno («conferma» / «rimettilo fra i da
 *   contattare») su di lui non vorrebbero dire niente. Per questo nel reparto
 *   sta in una fascia sua, con i gesti che gli appartengono. */
export function eSiFaVivoLui(l?: Lead | { data?: Partial<LeadData> | null } | null): boolean {
  return l?.data?.stato === "ci_ricontatta_lui";
}

/** La domanda è aperta, in un modo o nell'altro. Serve ai conteggi: «quanti
 *  ne restano da decidere» comprende anche quelli rimandati, o il numero
 *  scenderebbe premendo «Vedi dopo» — cioè rimandare sembrerebbe risolvere. */
export function aspettaUnaDecisione(
  l?: Lead | { data?: Partial<LeadData> | null } | null,
): boolean {
  return !!ricaricoDi(l?.data)?.daDecidere;
}

/** ── ⚠️ IN QUALE ELENCO STA, E IN UNO SOLO ────────────────────────────────
 *
 *  La regola «una persona sta in un elenco solo» era scritta nei cartelli ma
 *  non in nessuna funzione: ogni elenco si componeva filtrando a mano nella
 *  pagina, e i filtri si sono scollati. «Di ritorno» toglieva i messi da parte
 *  (`!eSaltato`), «Vedi dopo» e «Scritti su WhatsApp» no. Conseguenza: un
 *  contatto di ritorno messo da parte spariva dal suo reparto E dal suo
 *  conteggio — cioè la domanda restava aperta e nessuno la vedeva più — mentre
 *  lo stesso contatto, se gli era stato scritto, restava visibile. Zero casi il
 *  giorno in cui l'ho trovato, il che è il momento giusto per chiuderlo.
 *
 *  Adesso la destinazione si CALCOLA, una volta sola, qui. Chi disegna gli
 *  elenchi non filtra: chiede dove va questa scheda.
 *
 *  ⚠️ L'ORDINE DELLE DOMANDE È LA REGOLA, e non è alfabetico:
 *    1. non chiede niente          → nessun elenco
 *    2. è stato messo da parte     → «Messi da parte», perché quello è un
 *       gesto sulla TELEFONATA e vince su dove si guarda la domanda: la
 *       persona è fuori dal giro, e tenerla anche altrove vorrebbe dire
 *       lavorarla in due posti. La domanda non si perde: la riga lo dice
 *       (vedi `chiedeAncoraUnaDecisione`), e rientrando in coda torna al suo
 *       elenco da sé.
 *    3. gli è stato scritto        → «Scritti su WhatsApp» (il messaggio è più
 *       recente di qualunque rinvio)
 *    4. è stato rimandato          → «Vedi dopo»
 *    5. altrimenti                 → «Di ritorno», cioè decidi adesso. */
export type RepartoRitorno = "ritorno" | "rimandato" | "whatsapp" | "daparte" | null;

export function repartoDelRitorno(
  l?: Lead | { data?: Partial<LeadData> | null } | null,
): RepartoRitorno {
  const r = ricaricoDi(l?.data);
  if (!r?.daDecidere) return null;
  if (eSaltato(l as Lead)) return "daparte";
  if (r.whatsappIl) return "whatsapp";
  if (r.rimandatoIl) return "rimandato";
  return "ritorno";
}

/** Una scheda messa da parte che ha ancora una decisione aperta: la riga dei
 *  «Messi da parte» deve dirlo, o quella domanda non la ritrova nessuno. */
export function chiedeAncoraUnaDecisione(
  l?: Lead | { data?: Partial<LeadData> | null } | null,
): boolean {
  return repartoDelRitorno(l) === "daparte";
}

/** ── LA MODIFICA DA SALVARE QUANDO IL FILE LA RIPORTA A GALLA ─────────────
 *  ⚠️ NON TOCCA NIENT'ALTRO, ed è il punto della richiesta: «mantenendo stato
 *   attuale, note e tutto». Il file sa meno dell'archivio — di solito ha solo
 *   nome e telefono — e scriverci sopra cancellerebbe mesi di storia per
 *   aggiungere zero (è la stessa regola di `separaRitorni`, crm/import-backup).
 *  ⚠️ E IL CONTATORE NON RIPARTE MAI DA UNO: si somma a quello che c'era. È il
 *   numero che il committente vuole leggere sulla scheda — «quante volte
 *   l'abbiamo già ricaricato» — e azzerarlo a ogni decisione lo renderebbe una
 *   spia che dice sempre «una». */
export function patchRicarico(
  d?: Partial<LeadData> | null,
  lista?: string,
  ora: Date = new Date(),
): Partial<LeadData> {
  const prima = ricaricoDi(d);
  return {
    ricarico: {
      volte: (prima?.volte ?? 0) + 1,
      ultimo: ora.toISOString(),
      ...(String(lista || "").trim() ? { lista: String(lista).trim() } : {}),
      daDecidere: true,
      //  Lo stato di QUESTO momento: serve a raccontare dov'era quando è
      //  ricomparso, anche dopo che il pulsante l'ha rimesso fra i da
      //  contattare. Senza, la riga «era in appuntamento fissato» sparirebbe
      //  proprio nel caso in cui serve saperlo.
      ...(d?.stato ? { statoAllora: d.stato } : {}),
    },
  };
}

/** «Conferma»: resta esattamente com'è e torna fra i lead normali, dov'era.
 *  Non si cancella il ricarico — la storia è storia, e il numero di volte
 *  continua a leggersi sulla scheda — si spegne soltanto la domanda. */
export function patchConferma(d?: Partial<LeadData> | null): Partial<LeadData> {
  const r = ricaricoDi(d);
  if (!r) return {};
  //  ⚠️ `daDecidere: undefined` e non `false`: la scheda è un JSON, e una
  //   chiave `undefined` non viene scritta. Restano i campi che dicono
  //   qualcosa, senza una bandierina spenta da interpretare.
  //  ⚠️ E si cancella anche il rinvio: una decisione presa non può restare
  //   «rimandata», o la scheda resterebbe per sempre nella linguetta «Vedi
  //   dopo» pur non avendo più niente da chiedere.
  return {
    ricarico: {
      ...r,
      daDecidere: undefined,
      rimandatoIl: undefined,
      rimandatoDa: undefined,
      //  Decisa è decisa: esce anche dagli «scritti su WhatsApp», o resterebbe
      //  in un elenco di cose da chiudere senza avere più niente da chiudere.
      whatsappIl: undefined,
      whatsappDa: undefined,
    },
  };
}

/** «Rimettilo fra i da contattare»: torna in mezzo agli altri e lo stato
 *  riparte da capo.
 *  ⚠️ SI TOGLIE ANCHE IL SALTO. Chi era stato messo da parte resterebbe fuori
 *   dalla coda (vedi `eSaltato`), cioè il pulsante direbbe «rimesso in mezzo
 *   agli altri» e non lo rimetterebbe da nessuna parte.
 *  ⚠️ NON si cancellano appuntamenti, note o dati della trattativa: «resetta lo
 *   stato» è una frase sullo STATO. Cancellare un appuntamento fissato sarebbe
 *   una perdita che nessun pulsante di questa pagina può permettersi, e chi lo
 *   volesse ha la scheda per farlo. Che ci fosse, resta scritto nelle righe qui
 *   sotto. */
export function patchRimettiInCoda(
  d?: Partial<LeadData> | null,
  ora: Date = new Date(),
): Partial<LeadData> {
  const r = ricaricoDi(d);
  return {
    stato: STATO_RIMESSO,
    saltatoIl: undefined,
    saltatoDa: undefined,
    //  I tentativi a vuoto sono del giro precedente: ripartire con «4 tentativi
    //  a vuoto» addosso vorrebbe dire l'avviso rosso su una telefonata che non
    //  è ancora stata fatta.
    noRispondeCount: 0,
    ...(r
      ? {
          ricarico: {
            ...r,
            daDecidere: undefined,
            //  Come per la conferma: decisa è decisa, il rinvio se ne va.
            rimandatoIl: undefined,
            rimandatoDa: undefined,
            whatsappIl: undefined,
            whatsappDa: undefined,
            rimessoIl: ora.toISOString(),
          },
        }
      : {}),
  };
}

/** ── «VEDI DOPO»: METTERLO DA PARTE SENZA DECIDERE ────────────────────────
 *  Richiesta del committente: oltre a «conferma» e «rimettilo fra i da
 *  contattare», poter rimandare — e poi avere una scheda con tutti i rimandati,
 *  dove ci sono di nuovo le due opzioni.
 *
 *  Perché serve: la domanda arriva SEMPRE nel momento sbagliato, cioè in cima
 *  alla coda mentre si sta telefonando. Le vie erano due e nessuna delle due
 *  era «non lo so»: si finiva col premere «conferma» per togliersi il riquadro
 *  dagli occhi — cioè con una decisione presa per fretta, che è il modo in cui
 *  un duplicato torna a circolare senza che nessuno l'abbia guardato.
 *
 *  ⚠️ NON TOCCA LO STATO, e non è una dimenticanza: rimandare non è un esito.
 *   La scheda resta dov'era, con le sue note e i suoi appuntamenti; cambia
 *   solo dove compare la domanda.
 *  ⚠️ NON È «SALTA». Il salto (crm/importa/saltati.ts) toglie la persona dalla
 *   coda delle telefonate: è una decisione sulla TELEFONATA. Questo mette da
 *   parte la DOMANDA e lascia la persona in coda, al suo posto, chiamabile
 *   come tutti gli altri. Confonderli vorrebbe dire non chiamare più nessuno
 *   dei rimandati. */
export function patchVediDopo(
  d?: Partial<LeadData> | null,
  chi?: string,
  ora: Date = new Date(),
): Partial<LeadData> {
  const r = ricaricoDi(d);
  if (!r) return {};
  return {
    ricarico: {
      ...r,
      //  Resta vero: la domanda è aperta, ed è tutto il punto.
      daDecidere: true,
      rimandatoIl: ora.toISOString(),
      ...(String(chi || "").trim() ? { rimandatoDa: String(chi).trim() } : {}),
    },
  };
}

/** ── LE RIGHE NON MODIFICABILI ────────────────────────────────────────────
 *  Si calcolano, non si salvano: vedi l'intestazione. Chi le mostra le stampa
 *  e basta — non c'è nessun campo da proteggere perché non c'è nessun campo. */
export function righeRicarico(d?: Partial<LeadData> | null): string[] {
  const r = ricaricoDi(d);
  if (!r) return [];
  const righe: string[] = [];
  const quando = giorno(r.ultimo);
  righe.push(
    r.volte === 1
      ? `Già in archivio: è ricomparso in una lista importata${quando ? ` il ${quando}` : ""}.`
      : `Già in archivio: è ricomparso in una lista importata ${r.volte} volte${quando ? `, l'ultima il ${quando}` : ""}.`,
  );
  if (r.lista) righe.push(`Ultima lista: «${r.lista}».`);
  if (r.statoAllora) {
    const etichetta = LEAD_STATUS_LABEL[r.statoAllora] ?? r.statoAllora;
    righe.push(`Quando è ricomparso era «${etichetta}».`);
  }
  const scritto = giorno(r.whatsappIl);
  const volte = volteScritto(d);
  if (volte > 1) righe.push(`Gli è stato scritto ${volte} volte, e non ha ancora risposto.`);
  if (scritto)
    righe.push(
      r.whatsappConfermatoIl
        ? `Scritto su WhatsApp il ${scritto}${r.whatsappDa ? ` da ${r.whatsappDa}` : ""}, confermato${r.whatsappConfermatoDa ? ` da ${r.whatsappConfermatoDa}` : ""}: si aspetta la risposta.`
        : //  ⚠️ Finché non lo conferma una persona resta «aperto», non «mandato»:
          //   il tasto apre WhatsApp, non lo manda.
          `WhatsApp aperto il ${scritto}${r.whatsappDa ? ` da ${r.whatsappDa}` : ""}: da confermare che il messaggio sia partito.`,
    );
  const annullato = giorno(r.whatsappAnnullatoIl);
  if (annullato && !scritto)
    righe.push(
      `Il ${annullato} qualcuno ha segnato che il messaggio NON è stato mandato: è tornato in coda.`,
    );
  const rimandato = giorno(r.rimandatoIl);
  if (rimandato)
    righe.push(
      `Messo fra i «Vedi dopo» il ${rimandato}${r.rimandatoDa ? ` da ${r.rimandatoDa}` : ""}: la decisione è ancora da prendere.`,
    );
  const rimesso = giorno(r.rimessoIl);
  if (rimesso)
    righe.push(
      `Rimesso fra i «${LEAD_STATUS_LABEL[STATO_RIMESSO]}» il ${rimesso}: lo stato è stato azzerato a mano da qui.`,
    );
  return righe;
}

/** ── ⚠️ «GLI HO SCRITTO SU WHATSAPP» ──────────────────────────────────────
 *  Richiesta del committente: «quando clicco contatta su WhatsApp ai lead
 *  duplicati importati, fai che si spostano dentro contattati su WhatsApp».
 *
 *  Il gesto c'era — il pulsante apre WhatsApp col messaggio già scritto — ma
 *  non lasciava traccia: la scheda restava in cima alla coda come se nessuno
 *  avesse fatto niente, e il giorno dopo la si riapriva senza sapere se il
 *  messaggio era partito. Con dieci duplicati diventa: o si riscrive a due
 *  persone, o non si riscrive a nessuna.
 *
 *  ⚠️ NON DECIDE NIENTE, e non tocca lo stato del lead: scrivere non è avere
 *   una risposta. `daDecidere` resta vero e la scheda si sposta in una
 *   linguetta sua, dove la si chiude quando il cliente risponde.
 *  ⚠️ Si sovrascrive ogni volta: se gli si scrive di nuovo la settimana dopo,
 *   la data buona è l'ultima — è quella che dice da quanto si aspetta.
 *  ⚠️ E vince sul rinvio: un messaggio mandato è più recente di un «vedi
 *   dopo», e una scheda in due elenchi è una scheda che si decide due volte. */
export function patchContattatoWhatsApp(
  d?: Partial<LeadData> | null,
  chi?: string,
  ora: Date = new Date(),
): Partial<LeadData> {
  const r = ricaricoDi(d);
  if (!r) return {};
  return {
    ricarico: {
      ...r,
      daDecidere: true,
      whatsappIl: ora.toISOString(),
      //  ⚠️ Il conto sale e non torna indietro: `whatsappIl` si sovrascrive
      //   (è «da quanto aspetta»), e senza un conto a parte una persona
      //   scritta tre volte senza risposta è identica a una scritta oggi.
      whatsappVolte: volteScritto(d) + 1,
      ...(String(chi || "").trim() ? { whatsappDa: String(chi).trim() } : {}),
    },
  };
}

/** Quante volte gli è stato scritto. 0 = mai.
 *  ⚠️ Una data senza conto vale UNO: sono le schede scritte prima che il
 *   contatore esistesse, e dire «zero volte» su una scheda che porta la data
 *   del messaggio sarebbe una bugia leggibile a schermo. */
export function volteScritto(d?: Partial<LeadData> | null): number {
  const r = ricaricoDi(d);
  if (!r?.whatsappIl) return 0;
  const n = Number(r.whatsappVolte);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

/** Il messaggio è stato confermato da una persona (il check). */
export function eWhatsappConfermato(
  l?: Lead | { data?: Partial<LeadData> | null } | null,
): boolean {
  const r = ricaricoDi(l?.data);
  return !!r?.whatsappIl && !!r?.whatsappConfermatoIl;
}

/** ── IL CHECK: «SÌ, GLIEL'HO MANDATO» ─────────────────────────────────────
 *  Non sposta niente: la scheda resta dov'è, in attesa di risposta. Cambia
 *  solo che adesso lo sappiamo per certo — prima era «l'ho aperto», che non è
 *  la stessa cosa e in un elenco di venti righe fa la differenza fra
 *  riscrivere a qualcuno due volte e non scrivergli affatto. */
export function patchWhatsappConfermato(
  d?: Partial<LeadData> | null,
  chi?: string,
  ora: Date = new Date(),
): Partial<LeadData> {
  const r = ricaricoDi(d);
  if (!r?.whatsappIl) return {};
  return {
    ricarico: {
      ...r,
      daDecidere: true,
      whatsappConfermatoIl: ora.toISOString(),
      ...(String(chi || "").trim() ? { whatsappConfermatoDa: String(chi).trim() } : {}),
      //  Una conferma cancella un eventuale «non l'ho mandato» di prima: si è
      //  cambiato idea, e due date opposte sulla stessa riga non si leggono.
      whatsappAnnullatoIl: undefined,
    },
  };
}

/** ── LA X: «NO, NON L'HO MANDATO» ────────────────────────────────────────
 *  Riporta la scheda in coda, esattamente com'era prima di premere WhatsApp.
 *  ⚠️ SI CANCELLA `whatsappIl`, e non si scrive un esito «no»: quella data
 *   vuol dire «gli abbiamo scritto», ed è falsa. Lasciarla e aggiungerci
 *   accanto una bandierina vorrebbe dire che ogni elenco, ogni conteggio e
 *   ogni futura regola dovranno ricordarsi di guardarla — e prima o poi uno se
 *   ne dimentica, e quella persona resta in un limbo senza che nessuno le
 *   scriva più. Resta la data della smentita, per la storia. */
export function patchWhatsappNonInviato(
  d?: Partial<LeadData> | null,
  ora: Date = new Date(),
): Partial<LeadData> {
  const r = ricaricoDi(d);
  if (!r) return {};
  return {
    ricarico: {
      ...r,
      daDecidere: true,
      whatsappIl: undefined,
      whatsappDa: undefined,
      whatsappConfermatoIl: undefined,
      whatsappConfermatoDa: undefined,
      //  ⚠️ Il conto scende di uno, non si azzera: la X dice «QUESTO non l'ho
      //   mandato», non «non gliene ho mai scritto nessuno». Chi era stato
      //   scritto due volte e la terza no deve restare uno scritto due volte.
      whatsappVolte: volteScritto(d) > 1 ? volteScritto(d) - 1 : undefined,
      whatsappAnnullatoIl: ora.toISOString(),
    },
  };
}

/** ── ⚠️ RIPRENDERE UNA CONSULENZA CHE NON SI È FATTA ──────────────────────
 *  Richiesta del committente: sul contatto di ritorno un pulsante che scrive
 *  su WhatsApp ricordando l'appuntamento che c'era — con la sua data — e
 *  chiedendo quando vuole rifissare la consulenza.
 *
 *  ⚠️ NON PER TUTTI, e non è una limitazione: a chi non ha mai avuto un
 *   appuntamento questo messaggio racconterebbe una cosa mai successa. Vale
 *   solo per gli stati in cui una consulenza ERA stata presa — fissata,
 *   rifissata, da riprogrammare, o con il cliente che non si è presentato.
 *  ⚠️ Si guarda anche lo stato di ALLORA (`statoAllora`, quello del momento in
 *   cui è ricomparso in lista): chi è stato rimesso fra i «da contattare» ha
 *   lo stato azzerato, ma l'appuntamento mancato è successo lo stesso ed è
 *   proprio di quello che gli si vuole scrivere. */
export const STATI_DA_RIFISSARE: LeadStatus[] = [
  "appuntamento_fissato",
  "appuntamento_rifissato",
  "da_spostare",
  //  I due «Cliente assente»: `no_show` è quello di oggi, `non_fatto` quello
  //  storico che nell'archivio c'è ancora.
  "no_show",
  "non_fatto",
];

/** Ha senso proporgli di rifissare la consulenza? */
export function daRifissare(d?: Partial<LeadData> | null): boolean {
  const allora = ricaricoDi(d)?.statoAllora;
  return (
    (!!d?.stato && STATI_DA_RIFISSARE.includes(d.stato)) ||
    (!!allora && STATI_DA_RIFISSARE.includes(allora))
  );
}

const QUANDO = (iso?: string, ora?: string): string => {
  //  ⚠️ Sempre la forma con la T: `new Date("2026-10-02 15:00")` su iPhone
  //   risponde «data non valida», e il messaggio uscirebbe senza giorno.
  const d = new Date(`${String(iso || "").slice(0, 10)}T${String(ora || "12:00").slice(0, 5)}:00`);
  if (Number.isNaN(d.getTime())) return "";
  const giorno = d.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });
  return ora ? `${giorno} alle ${String(ora).slice(0, 5)}` : giorno;
};

/** Il link della raccolta dei risultati. Sta in `crm/whatsapp` insieme ai testi
 *  che lo allegano — e da lì si modifica dal pannello, senza pubblicare — e si
 *  riesporta qui perché era nato in questo file e c'è chi lo importa da qui. */
export { LINK_RISULTATI } from "@/crm/whatsapp";

/** ── ⚠️ COME SI SCRIVE A CHI SI ERA GIÀ FATTO VIVO ────────────────────────
 *  Richiesta del committente: «fai che tutti i messaggi posso modificarli da
 *  una scheda nelle impostazioni, con i segnaposto».
 *  Il testo NON sta più qui: sta nei modelli di WhatsApp
 *  (`ritorno_sospeso`, `ritorno_futuro`, `ritorno_mai` in crm/whatsapp), come
 *  tutti gli altri messaggi che partono ai clienti, e si modifica da
 *  Impostazioni → Messaggi. Qui resta l'unica cosa che il pannello non può
 *  sapere: QUALE dei tre serve adesso.
 *
 *  ⚠️ LE TRE SITUAZIONI SONO DIVERSE E RESTANO TRE MESSAGGI:
 *   · la consulenza è saltata → «è rimasta in sospeso»;
 *   · la consulenza è ancora davanti → non si dà per saltato un appuntamento
 *     che c'è ancora, gli si offre di spostarlo;
 *   · non l'ha mai presa → non si nomina nessuna data, sarebbe raccontargli
 *     una cosa mai successa.
 *  ⚠️ Il messaggio esce per TUTTI i contatti di ritorno, anche per l'ultimo
 *   caso: deciso dal committente.
 *
 *  @param chi  il nome del consulente che segue la scheda, che finisce nel
 *              segnaposto `{consulente}`. Vuoto = nel testo entra la riserva
 *              scritta nel modello («un consulente»): meglio nessun nome che il
 *              nome sbagliato davanti a chi ne ricorda un altro. */
/** ── GLI STATI IN CUI NESSUNO SI È ANCORA SEDUTO ──────────────────────────
 *  Dicono che siamo ancora al telefono: nessuno ha fatto la consulenza, e una
 *  data in archivio non basta a dire il contrario — capita di avere una data
 *  vecchia su una scheda tornata «da contattare».
 *  ⚠️ SERVE SOLO A NON DIRE UNA BUGIA GROSSA («l'abbiamo già fatta» a chi non
 *   l'ha mai fatta). La domanda «è stata svolta?» quando un appuntamento c'è
 *   stato la decide `eStatoNonSvolta`, che è la regola con cui questo CRM
 *   conta le consulenze della giornata: qui non si duplica, si esclude soltanto
 *   chi non è mai arrivato a un incontro. */
const ANCORA_AL_TELEFONO: string[] = [
  "da_contattare",
  "non_risponde",
  "segreteria",
  "richiamo",
  "annullato",
  "fissa_meet_dopo",
];

export function messaggioRifissa(
  d?: Partial<LeadData> | null,
  ora: Date = new Date(),
  chi?: string,
): string {
  /*  ⚠️ LA DATA SERVE ANCHE A CHI LA CONSULENZA L'HA FATTA: «l'abbiamo già
      fatta giovedì 18 settembre» è la riga che gli fa capire che ci ricordiamo
      di lui. Prima si calcolava solo per gli stati «da rifissare», e per tutti
      gli altri il messaggio usciva senza nessun giorno. */
  const quando = QUANDO(d?.dataMeeting, d?.oraMeeting);
  const passato =
    !!quando &&
    new Date(
      `${String(d?.dataMeeting || "").slice(0, 10)}T${String(d?.oraMeeting || "12:00").slice(0, 5)}:00`,
    ).getTime() < ora.getTime();
  /*  ── ⚠️ IL MESSAGGIO SEGUE IL MOTIVO DEL RITORNO ───────────────────
      Richiesta del committente: «in base alla motivazione del ritorno deve
      mettere il messaggio corretto».
      Quattro casi, e la domanda si fa in quest'ordine — prima «c'è un
      appuntamento?», poi «è passato?», poi «com'è andato»:
       · nessuna data       → non l'ha mai fatta;
       · data nel futuro    → ce l'ha ancora davanti;
       · data passata e stato «non svolta» → è saltata;
       · data passata, tutto il resto      → l'abbiamo già fatta.
      ⚠️ CHI NON SI È PRESENTATO SONO SOLO GLI ASSENTI E I DA RIPROGRAMMARE, e
       lo dice `eStatoNonSvolta` (crm/types), che è già la regola con cui
       questo CRM conta le consulenze svolte della giornata. Le parole del
       committente sono le stesse: «quelli che non si presentano sono solo
       quelli assenti o da spostare». Riscrivere qui un elenco di stati
       avrebbe voluto dire due idee di «svolta» nello stesso programma, e la
       seconda si sarebbe scostata dalla prima al primo stato nuovo.
      ⚠️ E si guarda anche lo STATO DI ALLORA: chi è stato rimesso fra i «da
       contattare» ha lo stato azzerato a mano, ma la consulenza l'ha fatta
       lo stesso — ed è proprio quella che non gli si deve dare per non
       fatta. */
  const stato = ricaricoDi(d)?.statoAllora || d?.stato;
  const chiave: ChiaveModello = !quando
    ? "ritorno_mai"
    : !passato
      ? "ritorno_futuro"
      : eStatoNonSvolta(stato)
        ? "ritorno_sospeso"
        : ANCORA_AL_TELEFONO.includes(String(stato ?? ""))
          ? "ritorno_mai"
          : "ritorno_fatta";
  return componiMessaggio(modelloDi(chiave), {
    //  Solo il nome di battesimo: «Ciao Mario Rossi» in una chat suona come un
    //  modulo, non come una persona.
    nome:
      String(d?.nome || "")
        .trim()
        .split(/\s+/)[0] || "",
    cognome: String(d?.cognome || "").trim(),
    consulente:
      String(chi || "")
        .trim()
        .split(/\s+/)[0] || "",
    quando,
    //  ⚠️ IL SOLO GIORNO, SENZA L'ORA, per una consulenza già FATTA: «l'abbiamo
    //   già fatta giovedì 18 settembre alle 15:00» suona come una convocazione
    //   — l'ora di una cosa passata non serve a nessuno. Per quelle da fissare
    //   o da spostare l'ora invece conta, ed è `{quando}`.
    giorno: QUANDO(d?.dataMeeting),
  });
}

/** ── ⚠️ CHE COS'ERA PRIMA, DETTO IN TRE PAROLE ────────────────────────────
 *  Richiesta del committente: «fai che sui lead di ritorno esca un distintivo:
 *  se è stata fatta una consulenza — e questo si vede dal tipo di stato del
 *  lead — oppure se è solo stato caricato, e se non risponde, o quello che è,
 *  lo deve dire».
 *
 *  A COSA SERVE. «Di ritorno» dice che è già passato di qui, ma non dice COSA
 *  è successo, e sono due telefonate diversissime: a chi ha già fatto la
 *  consulenza non si spiega il prodotto, a chi non ha mai risposto non si
 *  chiede «hai pensato al preventivo?», e a chi è solo stato caricato da una
 *  lista non si dà per scontato niente. Quell'informazione era sulla scheda —
 *  nello stato — ma a due clic di distanza, cioè fuori dalla telefonata.
 *
 *  ⚠️ SI LEGGE LO STATO DI ALLORA, QUANDO C'È. Chi è stato rimesso fra i «da
 *   contattare» ha lo stato azzerato a mano: il suo stato di adesso non
 *   racconta più niente, mentre `statoAllora` — com'era quando è ricomparso —
 *   racconta tutto. Guardare solo lo stato corrente vorrebbe dire dire «mai
 *   chiamato» a chi aveva fatto la consulenza il mese prima.
 *  ⚠️ NON INVENTA. Quando lo stato non dice niente di utile (una scheda appena
 *   caricata, senza tentativi) il distintivo lo dichiara — «mai chiamato» — e
 *   non tace: il silenzio si legge come «non lo so», e chi telefona resta a
 *   indovinare. */
export type TonoStoria = "neutro" | "buono" | "attesa" | "freddo";

export interface StoriaDelRitorno {
  /** Due o tre parole, quelle che stanno in un distintivo. */
  etichetta: string;
  /** La riga che spiega, per il `title` e per gli elenchi larghi. */
  nota: string;
  tono: TonoStoria;
}

const IN = (s: string | undefined, elenco: string[]): boolean => !!s && elenco.includes(s);

export function storiaDelRitorno(d?: Partial<LeadData> | null): StoriaDelRitorno {
  const r = ricaricoDi(d);
  //  Lo stato che RACCONTA: quello di allora se la scheda è stata rimessa in
  //  circolo (lì il corrente è «da contattare» per forza), altrimenti quello
  //  di adesso.
  const rimesso = !!r?.rimessoIl && d?.stato === STATO_RIMESSO;
  const stato = String((rimesso ? r?.statoAllora : d?.stato) || d?.stato || "");
  const tentativi = Number(d?.noRispondeCount) || 0;

  if (IN(stato, ["posa_in_sede", "posa_a_domicilio", "posa_da_spedire", "venduto", "acconto"]))
    return {
      etichetta: "Ha già comprato",
      nota: "Aveva già chiuso con noi: non è una trattativa da riaprire, è un cliente.",
      tono: "buono",
    };
  if (IN(stato, ["fatto", "sta_valutando", "in_attesa_acconto", "gestire_in_chat", "ripensamento"]))
    return {
      etichetta: "Consulenza già fatta",
      nota: "La consulenza c'è stata: conosce il prodotto e il prezzo. Non va rispiegato da capo.",
      tono: "buono",
    };
  if (IN(stato, ["no_show", "non_fatto", "da_spostare"]))
    return {
      etichetta: "Consulenza saltata",
      nota: "Un appuntamento c'era e non è stato fatto: qui si riprende da lì, non da zero.",
      tono: "attesa",
    };
  if (IN(stato, ["appuntamento_fissato", "appuntamento_rifissato", "viene_in_sede"]))
    return {
      etichetta: "Aveva un appuntamento",
      nota: "Aveva accettato una consulenza: si riparte da quella, non dalla presentazione.",
      tono: "attesa",
    };
  //  ⚠️ Separato dal richiamo: con questa persona la porta è aperta ma il
  //   passo non era nostro — e chi la riprende in mano deve saperlo, se no
  //   riparte con «come d'accordo la richiamo» su una chiamata che aspettava lui.
  if (IN(stato, ["ci_ricontatta_lui"]))
    return {
      etichetta: "Aveva detto che ci ricontattava lui",
      nota: "La palla era sua: aveva chiesto di farsi vivo lui.",
      tono: "attesa",
    };
  if (IN(stato, ["da_ricontattare", "richiamo", "fissa_meet_dopo"]))
    return {
      etichetta: "Aveva chiesto di essere richiamato",
      nota: "Ci aveva detto di risentirci: la porta era aperta.",
      tono: "attesa",
    };
  if (IN(stato, ["non_risponde", "segreteria", "irreperibile"]))
    return {
      etichetta:
        tentativi > 1 ? `Non ha mai risposto · ${tentativi} tentativi` : "Non ha mai risposto",
      nota: "Provato al telefono senza riuscire a parlarci: non sa ancora chi siamo.",
      tono: "freddo",
    };
  if (IN(stato, ["annullato", "perdi_tempo", "concluso", "sede_disdetta"]))
    return {
      etichetta: "Aveva detto di no",
      nota: "Si era chiuso da solo: qui si ricomincia solo se è cambiato qualcosa per lui.",
      tono: "freddo",
    };
  //  Resta «da contattare», con o senza tentativi a vuoto.
  if (tentativi > 0)
    return {
      etichetta:
        tentativi > 1
          ? `Chiamato ${tentativi} volte, mai risposto`
          : "Chiamato una volta, mai risposto",
      nota: "In archivio c'era già, ma non ci abbiamo mai parlato.",
      tono: "freddo",
    };
  return {
    etichetta: "Solo caricato, mai chiamato",
    nota: "Era in archivio da una lista precedente e nessuno l'ha mai chiamato: per lui siamo sconosciuti.",
    tono: "neutro",
  };
}

/** La stessa cosa in tre parole, per il distintivo accanto al nome. */
export function etichettaRicarico(d?: Partial<LeadData> | null): string {
  const volte = volteRicaricato(d);
  if (!volte) return "";
  return volte === 1 ? "Di ritorno" : `Di ritorno · ${volte}ª volta`;
}
