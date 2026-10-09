/** ─────────────────────────────────────────────────────────────────────────
 *  DI QUALE CONSULENZA È QUESTO DISPOSITIVO
 *
 *  Una domanda sola, una risposta sola. Sembra ovvio, e invece è il guasto che
 *  questo file esiste per non far succedere più: la pagina del preventivo se la
 *  chiedeva in DUE punti con due espressioni diverse — il canale in tempo reale
 *  usava il codice del link dell'ospite, il controllo periodico usava
 *  `getLiveId()`, cioè il codice della consulenza CONDOTTA da quel dispositivo.
 *  Sul telefono del cliente quel secondo codice non esiste (lui il codice ce
 *  l'ha nel link, non in memoria): la richiesta partiva senza, e il server
 *  rispondeva con la riga CONDIVISA, quella dove finiscono i contesti senza
 *  codice. Quella riga viene riscritta di continuo con un orologio fresco,
 *  quindi ogni secondo sorpassava lo stato vero arrivato dal canale e riportava
 *  il cliente al configuratore.
 *  Segnalazione del committente, parola per parola: «quando creo il preventivo
 *  non gli mostra il preventivo creato, ma solo mentre lo creo». È il quadro
 *  esatto: le voci si vedevano comparire — quelle passano dal canale — e il
 *  preventivo creato spariva un istante dopo.
 *
 *  ⚠️ NESSUN CODICE NON VUOL DIRE «PRENDI QUELLO CONDIVISO»: vuol dire che
 *   questo dispositivo non sta rispecchiando nessuno. Uno stato che non porta
 *   il codice della tua consulenza non è tuo, e mostrarlo vorrebbe dire far
 *   vedere a un cliente il preventivo di un altro.
 *  ───────────────────────────────────────────────────────────────────────── */

export interface ChiSiamo {
  /** link di sola visione (?watch=CODICE) */
  isViewer: boolean;
  /** pagina del cliente dentro la consulenza (?client=1&sess=CODICE) */
  isClient: boolean;
  /** codice della sessione VIVA per quell'ospite (può aggiornarsi sotto) */
  guestChan?: string | null;
  /** codice scritto nel link di sola visione */
  watchId?: string | null;
  /** codice scritto nel link del cliente */
  clientSess?: string | null;
  /** codice della consulenza condotta da QUESTO dispositivo (localStorage) */
  hostId?: string | null;
}

const pulito = (v: string | null | undefined): string | null => {
  const t = (v ?? "").trim();
  return t ? t : null;
};

/** Il codice della consulenza a cui questo dispositivo appartiene, o `null`.
 *
 *  ⚠️ Per l'ospite vince il codice della sessione VIVA (`guestChan`) su quello
 *   scritto nel link: se il consulente rigenera la consulenza, chi ha il link
 *   di prima deve seguire quella nuova invece di restare su un canale morto.
 *  ⚠️ Il codice di chi CONDUCE (`hostId`) vale solo per chi conduce: applicarlo
 *   a un ospite è precisamente l'errore da cui nasce questo file. */
export function codiceDiretta(p: ChiSiamo): string | null {
  if (p.isViewer) return pulito(p.guestChan) ?? pulito(p.watchId);
  if (p.isClient) return pulito(p.clientSess);
  return pulito(p.hostId);
}

/** ── E LO STESSO CODICE, LETTO DA UNA PAGINA CHE NON HA STATO ──────────────
 *  Alcune chiamate partono da fuori dal componente (il listino pubblico, i
 *  codici sconto) e non hanno sotto mano `isClient`/`isViewer`: hanno solo
 *  l'indirizzo della pagina e la memoria del dispositivo. La regola è la
 *  stessa di `codiceDiretta`, detta con quello che hanno.
 *
 *  ⚠️ L'INDIRIZZO VIENE PRIMA DELLA MEMORIA. Il cliente il codice ce l'ha nel
 *   link e in memoria non ha niente: leggendo solo la memoria — che è quello
 *   che si faceva — la sua richiesta partiva senza codice e il server gli
 *   rispondeva con il listino DI CASA, mentre il consulente sul suo schermo
 *   leggeva il proprio. Due prezzi diversi per la stessa consulenza, e quello
 *   sbagliato davanti a chi deve pagare.
 *   Al contrario, chi conduce nell'indirizzo non ha nessun codice: per lui
 *   resta la memoria. */
export function codiceDaPagina(p: {
  pathname?: string | null;
  search?: string | null;
  /** codice della consulenza condotta da questo dispositivo (localStorage) */
  hostId?: string | null;
}): string | null {
  let daIndirizzo: string | null = null;
  try {
    const q = new URLSearchParams(p.search ?? "");
    daIndirizzo = pulito(q.get("sess")) ?? pulito(q.get("watch"));
  } catch {
    /* indirizzo illeggibile: resta la memoria */
  }
  if (!daIndirizzo) {
    //  Il nome storico resta finché in giro ci sono link /videochiamata.
    const m = /^\/(?:meetly|videochiamata)\/([^/?#]+)/.exec(p.pathname ?? "");
    if (m) {
      try {
        daIndirizzo = pulito(decodeURIComponent(m[1]));
      } catch {
        daIndirizzo = pulito(m[1]);
      }
    }
  }
  return daIndirizzo ?? pulito(p.hostId);
}
