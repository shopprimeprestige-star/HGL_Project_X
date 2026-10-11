/** ── LA SCHEDA DEL CLIENTE CHE È RIMASTA A IERI ────────────────────────────
 *
 *  Quattro segnalazioni di fila sulla stessa cosa — «al cliente cambia
 *  schermata lo stesso» — e all'ultimo giro la causa era sempre la stessa: il
 *  suo dispositivo stava girando con il codice di PRIMA dell'aggiornamento.
 *  L'HTML non si mette in cache, ma il pacchetto nuovo lo scarica soltanto una
 *  RICARICA: una scheda aperta la mattina continua a comportarsi come la
 *  mattina, per ore, mentre da questa parte si pubblica un rimedio dopo
 *  l'altro e non se ne vede l'effetto.
 *
 *  ── COME CI SI ACCORGE, SENZA NUMERI DI VERSIONE ─────────────────────────
 *  Non serve inventarsi un contatore da tenere allineato fra server e
 *  pacchetto: ogni pubblicazione ribattezza i file (`/assets/index-XXXX.js`).
 *  Quindi si richiede la PROPRIA pagina — che non è in cache — e si guarda se
 *  i programmi che dichiara sono quelli che questa scheda ha davvero caricato.
 *  Se ne dichiara uno che qui dentro non è mai arrivato, questa scheda è
 *  vecchia.
 *
 *  ⚠️ SOLO I `<script src>`, NON I PRECARICAMENTI. Un `modulepreload` è un
 *   suggerimento: il browser può ignorarlo, e allora risulterebbe «mai
 *   caricato» anche su una scheda freschissima — cioè una ricarica a vuoto
 *   ogni minuto.
 *  ⚠️ MAI DURANTE LA VIDEOCHIAMATA: lì una ricarica costa qualche secondo di
 *   schermo nero. Si rimedia al caso tranquillo — il cliente che sta
 *   compilando il suo preventivo — che è poi quello che ha fatto nascere
 *   tutto; nella chiamata c'è il pulsante del consulente.
 *  ⚠️ UNA RICARICA PER VERSIONE. Se dopo essersi ricaricata la scheda vedesse
 *   ancora qualcosa che non combacia (una pubblicazione a metà, un file
 *   servito da un altro nodo), ricomincerebbe da capo all'infinito: si ricorda
 *   per quale file ci si è già ricaricati e non lo si rifà.
 *  ───────────────────────────────────────────────────────────────────────── */

/** ── I PROGRAMMI CHE UNA PAGINA DICHIARA ──────────────────────────────────
 *  ⚠️ NON SI CERCA UN `<script src>`: le pagine di questo sito non ne hanno.
 *   Misurato sulla pagina vera, in fondo all'HTML:
 *     <script type="module" async>import("/assets/index-CWrlNJX9.js")</script>
 *   La prima versione di questa funzione cercava `src=` e sulla pagina vera
 *   non trovava NIENTE: la scheda vecchia non si sarebbe mai accorta di
 *   esserlo, e il rimedio sarebbe rimasto inerte senza dare segno di sé.
 *
 *  ⚠️ E NON BASTA QUELLO D'AVVIO. Misurato anche questo, pubblicando due
 *   volte di fila: il nome del programma d'avvio NON cambia a ogni
 *   pubblicazione — cambia il pezzo che si è toccato. Guardando solo l'avvio,
 *   una scheda vecchia resterebbe vecchia proprio quando si è appena
 *   pubblicato il rimedio che le serve. Quindi si guardano tutti i pezzi che
 *   la pagina nomina: quelli della pagina che si sta guardando una scheda che
 *   la sta disegnando li ha per forza caricati. */
export function programmiDellaPagina(html: string): string[] {
  const testo = String(html || "");
  const out: string[] = [];
  const aggiungi = (u: string) => {
    //  Solo i nostri, e solo quelli col nome che cambia a ogni pubblicazione:
    //  un indirizzo esterno non dice niente sulla versione di questa scheda.
    if (u.startsWith("/assets/") && u.endsWith(".js") && !out.includes(u)) out.push(u);
  };
  const re = /["'\\](\/assets\/[A-Za-z0-9._-]+\.js)["'\\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(testo))) aggiungi(m[1]);
  return out;
}

/** ── L'IMPRONTA DI UNA PUBBLICAZIONE ──────────────────────────────────────
 *  Tutti i pezzi che la pagina nomina, in fila. Cambia se e solo se è stata
 *  pubblicata una versione nuova: le sigle dei file le riscrive la
 *  pubblicazione, nessun altro.
 *  ⚠️ Vuota se non si è capito niente della pagina: sul dubbio non si conclude
 *   niente (una risposta di errore, una rete che ha restituito altro). */
export function improntaDeiProgrammi(programmi?: string[] | null): string {
  const l = (programmi ?? []).filter(Boolean);
  return l.length ? [...l].sort().join("|") : "";
}

/** ── QUESTA SCHEDA È RIMASTA A IERI? ──────────────────────────────────────
 *  Si confronta la pagina CON SÉ STESSA nel tempo: l'impronta di adesso
 *  contro quella che questa scheda aveva visto la prima volta. Se è cambiata,
 *  in mezzo c'è stata una pubblicazione.
 *
 *  ⚠️ DUE STRADE SBAGLIATE, PROVATE PRIMA DI QUESTA, e vale la pena scriverle
 *   perché sembravano tutte e due ragionevoli:
 *   · «la pagina nomina un pezzo che io non ho» → la pagina del preventivo ne
 *     nomina una cinquantina, cioè quelli che POTREBBERO servirle: uno mai
 *     aperto non dimostra niente, e sarebbe una ricarica in faccia al cliente
 *     per un pezzo che non gli serviva;
 *   · «lo stesso pezzo con un'altra sigla» → per sapere qual è «lo stesso»
 *     bisogna tagliare la sigla dal nome, e i nomi veri sono `arrow-right-C-2Lc2vo.js`:
 *     qualunque taglio confonde due pezzi diversi, e confonderli vuol dire
 *     ricaricare senza motivo.
 *  ⚠️ LA PRIMA VOLTA SU UNA PAGINA NON SI CONCLUDE NIENTE: `vista` è vuota e
 *   si prende soltanto nota. Cambiando pagina (il cliente segue il consulente)
 *   cambiano i pezzi, e senza questa regola ogni cambio di schermata sarebbe
 *   una ricarica.
 *  ⚠️ UNA RICARICA PER IMPRONTA: una pubblicazione a metà, o un pezzo servito
 *   da un nodo rimasto indietro, manderebbe la scheda in ricarica all'infinito.
 *
 *  Restituisce l'impronta nuova (da ricordare) o "" se non c'è niente da fare.
 */
export function versioneVecchia(p: {
  /** L'impronta della pagina adesso. */
  adesso?: string;
  /** Quella che questa scheda aveva visto sulla STESSA pagina. */
  vista?: string;
  giaRicaricate?: string[] | null;
}): string {
  const ora = String(p.adesso || "");
  const prima = String(p.vista || "");
  if (!ora || !prima || ora === prima) return "";
  return (p.giaRicaricate ?? []).includes(ora) ? "" : ora;
}
