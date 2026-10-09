/** ── IL MESSAGGIO PER CHI LA CONSULENZA L'HA GIÀ FATTA ─────────────────────
 *
 *  Sono persone con cui abbiamo già passato un'ora: la consulenza c'è stata, e
 *  poi è passato del tempo — settimane, a volte mesi. A loro non si spiega di
 *  nuovo che cos'è: si RICORDA, si chiede come stanno, e si lascia qualcosa da
 *  guardare.
 *
 *  ── ⚠️ PERCHÉ NON SI ATTACCA IN CODA AL MESSAGGIO DELLO STATO ────────────
 *  Perché ne uscirebbe un messaggio che saluta due volte e chiede due volte
 *  come va: il testo dello stato comincia già con il nome e finisce già con
 *  una domanda. Qui il messaggio è INTERO e sostituisce quello: chi sceglie
 *  «allega i lavori» sta scegliendo di scrivere un'altra cosa, non la stessa
 *  con un link appiccicato — e la finestra glielo fa vedere prima di aprire
 *  WhatsApp.
 *
 *  ── ⚠️ L'ORDINE: PRIMA LA PERSONA, POI IL RICORDO, POI IL LINK ───────────
 *  «Come stai» viene prima di qualunque cosa nostra: a chi non sente da mesi
 *  si scrive per sapere come sta, non per mandargli materiale — e un messaggio
 *  che apre con un link è pubblicità, anche quando dentro c'è una domanda.
 *  Il link chiude, su una riga sua: è la cosa che si tocca, e su WhatsApp
 *  quello che viene dopo un link non lo legge quasi nessuno.
 */

/** ── GLI STATI IN CUI «RIPRENDERE IL FILO» È L'AZIONE ──────────────────────
 *  Tre, e sono quelli in cui la consulenza è alle spalle e stiamo aspettando
 *  una risposta che non arriva: il ricontatto fissato, chi ci sta pensando, il
 *  richiamo concordato.
 *  ⚠️ NON TUTTI GLI STATI DOPO LA CONSULENZA. «Attesa acconto» viene dopo una
 *   consulenza e ha il suo testo — dice dove versare —, «Cliente assente» ne ha
 *   un altro, le vendite un altro ancora. Scrivere a tutti «come stai? abbiamo
 *   fatto la consulenza il…» voleva dire buttare via il testo scritto apposta
 *   per quello stato: è la segnalazione del committente, ed è il motivo per cui
 *   questo elenco è CORTO e scritto a mano invece di essere «tutto quello che
 *   non è un appuntamento». */
const STATI_DI_RIPRESA = ["da_ricontattare", "sta_valutando", "richiamo"];

/** La pagina con i lavori. ⚠️ Una costante e non una stringa sparsa nei
 *  messaggi: il giorno che l'indirizzo cambia, un link vecchio incollato in
 *  venti testi porta venti clienti su una pagina che non c'è più. */
export const LINK_LAVORI = "https://hair-genius-hub.hair/media/F7MJ-A9WH-HVAW";

const GIORNI = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];
const MESI = [
  "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
  "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre",
];

/** «2026-07-24» → «giovedì 24 luglio». Vuoto se la data non si legge.
 *  ⚠️ L'ANNO SI SCRIVE SOLO SE NON È QUESTO. «Giovedì 24 luglio» detto a
 *   settembre si capisce; la stessa frase per una consulenza di due anni fa
 *   sarebbe una bugia involontaria — e sono proprio le schede vecchie quelle
 *   che questo messaggio va a riprendere.
 *  ⚠️ E i nomi dei giorni stanno scritti qui invece di venire da
 *   `toLocaleDateString`: dentro un Worker la lingua disponibile non è
 *   garantita, e un «Thursday» in mezzo a un messaggio italiano lo vede il
 *   cliente. */
export function giornoEsteso(iso: string, oggi: Date = new Date()): string {
  const s = String(iso ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
  const d = new Date(`${s}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  const base = `${GIORNI[d.getDay()]} ${d.getDate()} ${MESI[d.getMonth()]}`;
  return d.getFullYear() === oggi.getFullYear() ? base : `${base} ${d.getFullYear()}`;
}

/** Il messaggio per riprendere il filo con chi la consulenza l'ha già fatta.
 *  ⚠️ Non nomina la data («la consulenza del 12 marzo»): passato troppo tempo,
 *   una data esatta suona come un registro, e chi la legge si sente una riga
 *   di un archivio invece di una persona con cui si è parlato. */
/** ── IL MESSAGGIO PER RIPRENDERE IL FILO ──────────────────────────────────
 *  Uno solo, in due versioni: con i lavori e senza. ⚠️ E non sono due testi
 *  diversi — sono lo stesso messaggio a cui manca un paragrafo. Scritti
 *  separatamente sarebbero divergiti al primo ritocco, e la persona che li
 *  riceve a distanza di giorni avrebbe letto due voci diverse dello stesso
 *  centro.
 *
 *  La versione senza lavori serve quando le fotografie non servono — gliele
 *  abbiamo appena mandate, o la conversazione è già oltre — e resta un
 *  messaggio intero: saluto, il giorno in cui ci siamo visti, l'offerta di
 *  risentirsi, la domanda. Non un messaggio dimezzato.
 */
export function messaggioRipresa(
  nome: string,
  quando?: string,
  conLavori = true,
  link: string = LINK_LAVORI,
): string {
  const chi = String(nome ?? "").trim();
  const giorno = giornoEsteso(String(quando ?? ""));
  return [
    chi ? `Ciao ${chi}, come stai?` : "Ciao, come stai?",
    "",
    //  ⚠️ Il giorno esatto quando c'è, una frase generica quando non c'è:
    //   «abbiamo fatto la consulenza» senza dire quando, a distanza di mesi,
    //   fa chiedere «quale?» — e una data sbagliata sarebbe peggio di nessuna.
    giorno
      ? `Abbiamo fatto la consulenza ${giorno}.`
      : "È passato un po' dalla nostra consulenza.",
    "",
    ...(conLavori
      ? [
          "Ti lascio qualche nostro lavoro: te li avevo già mostrati, ma magari non li ricordi. "
            + "È l'Invisible Derm Protocol di cui ti parlavo — non è un patch e non è una protesi, "
            + "è la loro evoluzione.",
          "",
        ]
      : [
          //  Senza le fotografie il nome del sistema va detto lo stesso: è
          //  quello di cui si è parlato per un'ora, e la frase dopo — «se non
          //  ricordi le differenze» — senza di lui resterebbe appesa a niente.
          "Volevo sapere se hai avuto modo di pensare all'Invisible Derm Protocol di cui ti "
            + "parlavo.",
          "",
        ]),
    //  ⚠️ L'OFFERTA DI RISPIEGARE STA QUI, subito dopo la frase che nomina le
    //   differenze, e non in fondo: è lì che nasce il dubbio («patch, protesi,
    //   evoluzione: e quindi?»), e un aiuto offerto tre righe dopo arriva
    //   quando la persona ha già smesso di chiederselo.
    //  ⚠️ E dice «rispiego», non «spiego»: gliel'abbiamo già raccontato di
    //   persona, e trattarlo come se non avesse mai sentito niente è il modo
    //   più veloce per fargli sentire che di lui non ci ricordiamo.
    "Se non ricordi le differenze possiamo sentirci: te le rispiego volentieri.",
    "",
    ...(conLavori ? [link, ""] : []),
    //  ⚠️ La domanda sta in FONDO, dopo il link, e non è un caso: è la sola
    //   riga che chiede una risposta, e messa prima verrebbe letta mentre il
    //   pollice sta già andando sul link.
    //  ⚠️ E la chiusura CHIEDE, invece di aspettare. «Fammi sapere» è la
    //   differenza fra un messaggio che finisce e uno che lascia una cosa da
    //   fare a chi legge: senza, un messaggio gentile si chiude da solo e la
    //   risposta resta facoltativa.
    "Hai deciso qualcosa? Se ti servono altre informazioni ci sentiamo volentieri al telefono, "
      + "quando preferisci: fammi sapere.",
  ].join("\n");
}

/** Il messaggio con i lavori. Resta come nome perché è quello che si legge nei
 *  tre punti da cui si scrive. */
export const messaggioLavori = (nome: string, quando?: string, link: string = LINK_LAVORI): string =>
  messaggioRipresa(nome, quando, true, link);


/** ── LA CONSULENZA È GIÀ STATA FATTA? ──────────────────────────────────────
 *  ⚠️ SEGNALAZIONE DEL COMMITTENTE: «quando lo stato è appuntamento fissato, o
 *   altri stati, i pulsanti devono essere per quello stato con il messaggio
 *   corretto. Ora invece mostra sempre il messaggio del ricontatto».
 *   Il guasto stava qui: il tasto di WhatsApp decideva quale testo mandare
 *   guardando SOLO se la scheda avesse una data di consulenza. Ma quella data
 *   ce l'hanno anche gli appuntamenti che devono ancora succedere — sono
 *   appuntamenti, la data è il loro motivo di esistere — e così a chi aveva un
 *   incontro fissato per domani partiva «abbiamo fatto la consulenza venerdì
 *   25 settembre». Cioè il messaggio sbagliato proprio alle schede più
 *   delicate che abbiamo.
 *
 *  La data da sola non basta: va letta INSIEME allo stato. È la stessa regola
 *  di `promemoriaUtile` (crm/whatsapp), e per la stessa ragione.
 *   · stato di appuntamento → l'incontro deve ancora avvenire, qualunque cosa
 *     dica la data;
 *   · stato che dice che non si è svolta (assente, da spostare) → non è
 *     avvenuta, e ricordarla sarebbe una bugia;
 *   · negli altri casi la consulenza è alle spalle solo se il giorno È
 *     PASSATO. Una scheda «In valutazione» con la consulenza fissata fra tre
 *     giorni esiste, e a lei si scrive del futuro, non del passato.
 */
export function consulenzaAlleSpalle(
  stato: string | undefined | null,
  quando: string | undefined | null,
  oggi: string = new Date().toISOString().slice(0, 10),
): boolean {
  //  ⚠️ PRIMA LO STATO. È lui a dire che cosa stiamo facendo con questa
  //   persona; la data dice solo se il racconto sta in piedi.
  if (!STATI_DI_RIPRESA.includes(String(stato ?? ""))) return false;
  const giorno = String(quando ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(giorno)) return false;
  //  ⚠️ E il giorno dev'essere passato: esiste la scheda «In valutazione» con
  //   un secondo incontro già in calendario, e a lei non si parla al passato.
  return giorno <= String(oggi).slice(0, 10);
}

/** ── IL LINK APPESO A UN MESSAGGIO CHE C'È GIÀ ─────────────────────────────
 *  Quando la consulenza NON è alle spalle, «allega i nostri lavori» non può
 *  voler dire «manda un altro messaggio»: il testo giusto per quello stato è
 *  già scritto — conferma un appuntamento, chiede una risposta — e sostituirlo
 *  con il racconto di una consulenza mai avvenuta è il guasto che stiamo
 *  riparando. Qui il link si AGGIUNGE in fondo, su righe sue.
 *  ⚠️ In fondo e non in mezzo: su WhatsApp quello che viene dopo un link non
 *   lo legge quasi nessuno, quindi il link va messo dove non copre niente. */
export function conLinkLavori(messaggio: string, link: string = LINK_LAVORI): string {
  const base = String(messaggio ?? "").trimEnd();
  if (!base) return link;
  if (base.includes(link)) return base;   // già allegato: non si ripete
  return `${base}\n\nIntanto ti lascio qualche nostro lavoro:\n${link}`;
}
