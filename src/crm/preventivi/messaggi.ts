/** ── PREVENTIVI · I MESSAGGI DA MANDARE AL CLIENTE ─────────────────────────
 *
 *  A COSA SERVE
 *  Dalla riga dell'elenco si scrive al cliente senza aprire il preventivo. I
 *  testi non nascono qui: sono i MODELLI di crm/whatsapp.ts, quelli che chi
 *  scrive ai clienti tutti i giorni può correggere da /CRM/whatsapp senza
 *  chiedere il permesso a nessuno. Qui c'è solo la SCELTA — quale dei modelli
 *  ha senso davanti a un preventivo già mandato — e la composizione con i
 *  valori veri.
 *
 *  ── PERCHÉ UN TESTO È SCRITTO QUI DENTRO E GLI ALTRI NO ───────────────────
 *  Il primo, «Ecco il Suo preventivo», è l'unico che in `MODELLI_ORIGINALI` non
 *  esiste: quell'elenco ha un modello per ogni STATO della trattativa, e
 *  «mando il preventivo» non è uno stato. Aggiungerne la chiave costerebbe
 *  QUATTRO modifiche in tre file — `ChiaveModello`, `MODELLI_ORIGINALI`,
 *  `ETICHETTA_MODELLO_EXTRA` e `GRUPPI_MODELLI` in CRM.whatsapp.tsx — e la
 *  quarta è quella che ci si dimentica: `link_consulenza` è lì da mesi e non è
 *  nell'elenco dell'editor, quindi oggi è un modello che nessuno può correggere.
 *  Finché quella chiave non esiste davvero il testo sta qui, dichiarato, e usa
 *  comunque `componiMessaggio` — quindi `{firma}` resta LA firma condivisa:
 *  cambiarla da /CRM/whatsapp cambia anche questa. Vedi «serve da altri».
 *
 *  ⚠️ E NON È LA QUINTA VERSIONE DEL MESSAGGIO. shop/QuotesPanel.tsx ne compone
 *   una sua a mano — «Ciao {nome}, ecco il tuo preventivo…» — DEL TU, contro
 *   tutto il resto del repository che dà del Lei prima della vendita. Questa
 *   pagina non aggiunge una variante: passa dalle regole di `componiMessaggio`
 *   (riga vuota che sparisce, firma unica) come ogni altra schermata del CRM.
 *
 *  ⚠️ `{link}` QUI È IL LINK DEL PREVENTIVO, NON DELLA STANZA. In crm/whatsapp
 *   quel segnaposto è dichiarato «Link della stanza per la videochiamata» e
 *   `valoriDaLead` lo riempie con `linkStanzaDi`. Qui NON si passa da
 *   `valoriDaLead`: i valori si costruiscono espliciti, e dentro `{link}` ci va
 *   `linkPreventivo(ref)`. È il motivo per cui il messaggio va LETTO prima di
 *   partire (vedi `segnapostiResidui` nel pannello).
 *  ───────────────────────────────────────────────────────────────────────── */

import { componiMessaggio, modelloDi, type ValoriMessaggio } from "@/crm/whatsapp";

/** ── IL NUMERO PRONTO PER WHATSAPP ─────────────────────────────────────────
 *  `buildWhatsAppLink` ripulisce il numero ma NON aggiunge il prefisso: un
 *  «333 1234567» scritto senza +39 diventa `wa.me/3331234567`, che WhatsApp
 *  interpreta come un numero di un altro Paese — la chat si apre vuota e il
 *  messaggio non parte, senza che nessuno lo dica.
 *  ⚠️ Questa funzione è la stessa `waNumero` di shop/QuotesPanel.tsx, che però
 *   non è esportata. Copiarla è il male minore rispetto a mandare un cliente su
 *   un numero inesistente, ma il posto giusto è crm/whatsapp.ts insieme a
 *   `buildWhatsAppLink`: vedi «serve da altri». */
export function numeroPerWhatsApp(tel: string | null | undefined): string {
  const d = String(tel || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("00")) return d.slice(2);
  if (d.startsWith("39") && d.length >= 11) return d;
  //  Nove o dieci cifre nude: è un numero italiano scritto senza prefisso, il
  //  modo in cui lo scrivono tutti in un modulo.
  if (d.length >= 9 && d.length <= 10) return `39${d}`;
  return d;
}

export type ChiaveMessaggio = "invio" | "valuta" | "richiamo" | "acconto" | "silenzio";

/** ── IL TESTO DELL'INVIO ───────────────────────────────────────────────────
 *  Segue le regole scritte in testa a crm/whatsapp.ts, e ognuna vale una riga:
 *   · il nome nella prima riga — un messaggio che non ti nomina si legge come
 *     un invio di massa, e come tale viene ignorato;
 *   · il link su una riga sua, senza niente intorno: è la cosa da toccare;
 *   · UNA domanda sola e CHIUSA, che si può liquidare con un sì o un no;
 *   · nessun prezzo e nessuna cifra. Il totale sta DENTRO il preventivo e
 *     dentro l'anteprima che WhatsApp disegna da sé: riscriverlo nel messaggio
 *     significa mandarlo in chiaro a chiunque legga sopra la spalla del
 *     cliente, e rischiare di dirne uno diverso da quello della pagina.
 *  ⚠️ La riga del link è tutta e sola sua: `{link}` è FACOLTATIVO, quindi se il
 *   link non si costruisce la riga sparisce invece di arrivare come «Lo trova
 *   qui:» seguito dal nulla. */
const TESTO_INVIO =
  "Buongiorno {nome}, sono {consulente|un consulente} di Hair Genius Labs: Le ho preparato il preventivo di cui abbiamo parlato.\n\nLo trova qui: {link}\n\nSe lo apre con calma e mi dice se è tutto chiaro, Le rispondo io direttamente qui.\n\n{firma}";

export interface SceltaMessaggio {
  chiave: ChiaveMessaggio;
  /** come si chiama nel pannello: dice il MOMENTO, non il modello */
  etichetta: string;
  /** una riga: quando si usa questo e non un altro */
  nota: string;
  /** true = dentro il testo c'è {link}, quindi serve il link del preventivo */
  conLink: boolean;
  /** il modello vero, letto al momento della composizione (i testi si possono
   *  correggere da /CRM/whatsapp mentre la pagina è aperta) */
  modello: () => string;
}

/** ── I CINQUE MOMENTI ──────────────────────────────────────────────────────
 *  Sono i cinque in cui si scrive davvero a chi ha un preventivo in mano, in
 *  ordine di frequenza. Nessuno è stato inventato per riempire l'elenco: gli
 *  ultimi quattro sono modelli che esistono già, e sono già i testi giusti.
 *  ⚠️ «Silenzio» è `irreperibile`, ed è l'unico modello del repository che
 *   nomina il preventivo. È scritto per SMETTERE di chiedere: si usa dopo
 *   settimane di nulla, non come secondo sollecito. */
export const MESSAGGI: SceltaMessaggio[] = [
  {
    chiave: "invio",
    etichetta: "Ecco il Suo preventivo",
    nota: "L'invio del link. Apre la consulenza: il cliente vede quello che vedi tu.",
    conLink: true,
    modello: () => TESTO_INVIO,
  },
  {
    chiave: "valuta",
    etichetta: "Sta valutando",
    nota: "L'ha letto e non risponde da qualche giorno: fa uscire il dubbio finché è piccolo.",
    conLink: false,
    modello: () => modelloDi("sta_valutando"),
  },
  {
    chiave: "richiamo",
    etichetta: "Come d'accordo",
    nota: "Il richiamo concordato con lui.",
    conLink: false,
    modello: () => modelloDi("da_ricontattare"),
  },
  {
    chiave: "acconto",
    etichetta: "Manca l'acconto",
    nota: "Ha detto sì: per bloccare la data serve solo il bonifico.",
    conLink: false,
    modello: () => modelloDi("in_attesa_acconto"),
  },
  {
    chiave: "silenzio",
    etichetta: "Non disturbo oltre",
    nota: "Settimane di silenzio: si dice che il preventivo resta valido e si smette di chiedere.",
    conLink: false,
    modello: () => modelloDi("irreperibile"),
  },
];

export const messaggioDi = (c: ChiaveMessaggio) =>
  MESSAGGI.find((m) => m.chiave === c) ?? MESSAGGI[0];

/** Compone il messaggio scelto con i valori veri di QUESTO preventivo.
 *  ⚠️ `link` arriva da fuori e può essere vuoto: costruirlo apre una sessione
 *   di consulenza (vedi shop/quote-link.ts), quindi non è un effetto che possa
 *   partire da una funzione di composizione — lo decide chi preme. */
export function componiPerPreventivo(
  chiave: ChiaveMessaggio,
  valori: { nome: string; cognome: string; consulente: string; link: string },
): string {
  const scelta = messaggioDi(chiave);
  const v: ValoriMessaggio = {
    nome: valori.nome,
    cognome: valori.cognome,
    consulente: valori.consulente,
    //  Il link si passa SOLO ai testi che lo prevedono: negli altri il
    //  segnaposto non c'è, e se qualcuno ce l'ha aggiunto dall'editor si
    //  aspetta la stanza della videochiamata, non il preventivo.
    link: scelta.conLink ? valori.link : "",
  };
  return componiMessaggio(scelta.modello(), v);
}
