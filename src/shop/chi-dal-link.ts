/** ── UN LINK PER CIASCUNO, NELLA STESSA STANZA ─────────────────────────────
 *
 *  Segnalazione del committente: «quando invio il link alle 3 persone della
 *  consulenza deve generare un link univoco per ogni persona, perché ora mette
 *  a tutti lo stesso nome».
 *
 *  ── COM'ERA, E PERCHÉ È NATO COSÌ ────────────────────────────────────────
 *  Tre persone prenotate alla stessa ora con lo stesso consulente sono UNA
 *  consulenza: stessa stanza, stesso codice, stesso link — ed è giusto, è
 *  stato chiesto così («il link lo genera uguale per tutti e 3 e tutti e 3
 *  hanno accesso»). Ma il link diceva solo DOVE entrare, non CHI entra: tutti
 *  e tre arrivavano senza nome, e il programma non può indovinarlo — quando in
 *  stanza si aspetta più di una persona, tirare a indovinare vorrebbe dire
 *  aprire a uno il preventivo di un altro (vedi `personaDaAdottare`).
 *  Risultato: tre persone identiche sullo schermo del consulente, e il
 *  preventivo di ciascuno irraggiungibile.
 *
 *  ── COM'È ADESSO ─────────────────────────────────────────────────────────
 *  La stanza resta una sola — il link cambia di una cosa sola, il gettone di
 *  chi lo riceve:
 *      .../meetly/abc-defg-hij?chi=p3f91a2c
 *  Chi apre quel link è riconosciuto senza dover toccare il proprio nome alla
 *  porta, e il suo preventivo è suo dal primo istante.
 *
 *  ⚠️ IL GETTONE NON È UN SEGRETO E NON APRE NIENTE DA SOLO: è l'impronta
 *   della scheda (`gettoneDi`), serve a dire «sono io» dentro una stanza in
 *   cui si entra comunque col codice. Chi inoltra il suo link a un amico gli
 *   passa la propria identità in quella consulenza — esattamente come
 *   passandogli il telefono — e non altro.
 *  ⚠️ SI AGGIUNGE SOLO A UNA STANZA NOSTRA: su un link esterno (un Meet
 *   scritto a mano in scheda) una nostra domanda in coda all'indirizzo non
 *   vuol dire niente, e in certi casi lo rompe.
 *  ⚠️ E NON SI SOVRASCRIVE: se il link ne porta già uno, è quello buono — è
 *   stato composto da chi sapeva per chi era.
 *  ───────────────────────────────────────────────────────────────────────── */

/** Il nome della domanda in coda all'indirizzo. Corto, perché finisce in un
 *  messaggio WhatsApp che la gente legge. */
export const CHIAVE_CHI = "chi";

const pulito = (v: unknown): string =>
  String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 16);

/** Il gettone scritto nel link, se c'è. */
export function gettoneDalLink(ricerca?: string | null): string {
  try {
    return pulito(new URLSearchParams(String(ricerca || "")).get(CHIAVE_CHI));
  } catch {
    return "";
  }
}

/** ── IL GIRO DEL LINK ───────────────────────────────────────────────────────
 *  Dopo «Esci» il vecchio link non vale più; «Invita di nuovo» ne dà uno con
 *  un giro nuovo e casuale: `...?chi=p3f91a2c&k=9f3a1c7e22b04d58`. Un link
 *  senza `k` è del giro «0», quello di sempre.
 *  ⚠️ `k` vive solo nell'indirizzo e nelle POST al server: mai in `hello` né
 *   nel roster, che arrivano a tutta la stanza. */
export const CHIAVE_GIRO = "k";

const pulitoGiro = (v: unknown): string =>
  String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 32);

/** Il giro scritto nel link, se c'è ("" = link senza `k`, cioè il giro «0»). */
export function giroDalLink(ricerca?: string | null): string {
  try {
    return pulitoGiro(new URLSearchParams(String(ricerca || "")).get(CHIAVE_GIRO));
  } catch {
    return "";
  }
}

/** Lo stesso link, con dentro chi lo riceve (e, se c'è, il giro). Senza
 *  gettone — o se non è una stanza nostra — torna il link così com'era. */
export function linkPerPersona(link?: string | null, gettone?: string | null, giro?: string | null): string {
  let indirizzo = String(link || "").trim();
  const g = pulito(gettone);
  if (!indirizzo || !g) return indirizzo;
  //  Solo le stanze nostre: /meetly/<codice> (e il vecchio /videochiamata/).
  if (!/\/(?:meetly|videochiamata)\//i.test(indirizzo)) return indirizzo;
  //  ⚠️ L'ancora resta in fondo: «…/meetly/abc#x» con la domanda appiccicata
  //   dopo il cancelletto non arriva al programma.
  //  ⚠️ E NON SI SOVRASCRIVE: se il link ne porta già una, è quella buona.
  const aggiungi = (chiave: string, valore: string) => {
    if (!valore || new RegExp(`[?&]${chiave}=`, "i").test(indirizzo)) return;
    const [prima, ancora] = indirizzo.split("#");
    indirizzo = `${prima}${prima.includes("?") ? "&" : "?"}${chiave}=${valore}${ancora ? `#${ancora}` : ""}`;
  };
  aggiungi(CHIAVE_CHI, g);
  aggiungi(CHIAVE_GIRO, pulitoGiro(giro));
  return indirizzo;
}

/* ═══════════════════════════════════════════════════════════════════════════
   L'ANTEPRIMA È DI CHI RICEVE IL LINK, NON DELLA STANZA
   ───────────────────────────────────────────────────────────────────────────
   Segnalazione del committente, il giorno dopo i link personali: «ora
   l'anteprima mostra il nome del primo che ho assegnato a quell'orario, invece
   deve mostrare il nome corretto a ogni persona sul suo link».

   ── PERCHÉ ────────────────────────────────────────────────────────────────
   Il biglietto che si vede nel riquadro di WhatsApp è un'immagine depositata
   sotto un codice (`anteprima:invito:<codice>`), e per la stanza quel codice
   era il codice della stanza — UNO per tutti e tre. Tre persone nella stessa
   consulenza depositavano a turno sopra lo stesso file: restava il nome di
   chi era passato per primo, e i due che ricevevano il link dopo vedevano
   scritto il nome di un altro cliente. Non è solo brutto: è il nome di una
   persona che sta valutando un trapianto, mandato a qualcun altro.

   ── COM'È ADESSO ─────────────────────────────────────────────────────────
   Il link porta già il gettone di chi lo riceve (`?chi=`). Lo stesso gettone
   entra nel codice sotto cui si deposita e si cerca il biglietto:

       stanza sola   jqj-ypdd-pzt                 (una persona: tutto com'era)
       per ciascuno  jqj-ypdd-pzt_pb4b5c685       (tre persone: tre biglietti)

   ⚠️ IL SEGNO DI SEPARAZIONE NON È LIBERO. Il codice attraversa
    `codicePulito` (api.anteprima), che tiene solo lettere, cifre, punto,
    trattino e trattino basso. La tilde — la prima scelta — veniva buttata via
    senza dire niente, e il deposito finiva di nuovo sotto la sola stanza. Il
    trattino non si può usare: i codici di stanza ne sono pieni. Resta il
    trattino basso, che nessun codice nostro contiene.
   ⚠️ IL GETTONE SI RICONOSCE DALLA FORMA, non dalla posizione: minuscolo, una
    «p» e fino a otto segni (vedi `gettoneDi` in crm/fascia-consulenza). Senza
    questo controllo un codice d'invito con un trattino basso dentro si
    spezzerebbe in due pezzi che non sono né una stanza né una persona.
   ─────────────────────────────────────────────────────────────────────────── */

/** Il segno che separa la stanza da chi la riceve. */
export const SEGNO_CHI = "_";

/** La forma di un gettone, e l'unica cosa che lo distingue da un pezzo di
 *  codice qualunque. */
const PARE_UN_GETTONE = /^p[a-z0-9]{1,8}$/;

/** Il codice del deposito spezzato nei suoi due pezzi. `gettone` vuoto = è un
 *  codice normale (una stanza, o una pagina d'invito). */
export function spezzaCodiceAnteprima(grezzo?: string | null): {
  codice: string;
  gettone: string;
} {
  const tutto = String(grezzo || "").trim();
  const taglio = tutto.lastIndexOf(SEGNO_CHI);
  if (taglio <= 0) return { codice: tutto, gettone: "" };
  const coda = tutto.slice(taglio + 1);
  if (!PARE_UN_GETTONE.test(coda)) return { codice: tutto, gettone: "" };
  return { codice: tutto.slice(0, taglio), gettone: coda };
}

/** Il codice sotto cui sta il biglietto DI QUESTA PERSONA in questa stanza.
 *  Senza gettone — o con un gettone che non ha la forma giusta — torna il
 *  codice così com'era, che è il caso della consulenza con una persona sola.
 *  ⚠️ Idempotente: un codice che il gettone ce l'ha già non se lo prende due
 *   volte, altrimenti due giri dello stesso lavoro depositerebbero sotto due
 *   codici diversi. */
export function codiceAnteprimaDi(codice?: string | null, gettone?: string | null): string {
  const base = spezzaCodiceAnteprima(codice).codice;
  const g = pulito(gettone);
  if (!base || !g || !PARE_UN_GETTONE.test(g)) return base;
  return `${base}${SEGNO_CHI}${g}`;
}

/** ── CHI ENTRA, SENZA SCEGLIERE IL PROPRIO NOME ─────────────────────────────
 *  Richiesta del committente (13/10/2026): «la persona non deve selezionare il
 *  suo nome: dal link dove entra deve entrare già col suo nome e cognome».
 *
 *  Il link mandato su WhatsApp porta già il gettone di chi lo riceve
 *  (`linkPerPersona`), e il motore della chiamata lo legge appena la pagina si
 *  apre. La porta però guardava solo QUANTE persone erano attese: con una
 *  entrava da sola, con due o più mostrava l'elenco «chi sei?» anche a chi il
 *  link l'aveva personale.
 *  Adesso: se la persona di questo dispositivo (dal link o già scelta prima) è
 *  fra gli attesi, entra lei. Con una persona sola attesa, entra quella come
 *  prima. Altrimenti — link inoltrato, gettone di un'altra stanza — resta
 *  l'elenco: indovinare vorrebbe dire mettere qualcuno al posto di un altro. */
export function chiEntra<P extends { gettone: string }>(p: {
  attesi: P[] | null | undefined;
  /** il gettone di questo dispositivo ("" = non si sa) */
  mio?: string | null;
}): P | null {
  const attesi = p.attesi ?? [];
  const mio = pulito(p.mio);
  if (mio) {
    const trovato = attesi.find((a) => pulito(a.gettone) === mio);
    if (trovato) return trovato;
  }
  return attesi.length === 1 ? attesi[0] : null;
}
