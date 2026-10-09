/** ── QUALCUNO BUSSA: È NUOVO, O È SEMPRE LUI? ──────────────────────────────
 *
 *  Segnalazione del committente: «le persone ospiti sentono un suono come un
 *  campanello ogni 5 secondi».
 *
 *  DA DOVE VENIVA QUEL CAMPANELLO. Chi aspetta in sala d'attesa RIBUSSA da
 *  solo ogni 4 secondi — serve, perché il consulente può arrivare dopo di lui.
 *  Dall'altra parte il presentatore suona la campana solo quando la persona è
 *  NUOVA: la riconosce dal codice del dispositivo, e chi ha già bussato
 *  aggiorna la sua riga in silenzio.
 *  Il codice del dispositivo però può mancare — su iPhone in navigazione
 *  privata, o con l'archiviazione del sito bloccata, `myDeviceId()` risponde
 *  stringa vuota — e allora nessuno dei due riconoscimenti funzionava:
 *  `admittedDevices.has("")` è sempre falso, e una riga tolta dall'elenco
 *  (perché l'ingresso era già stato accettato) non c'è più da ritrovare.
 *  Risultato: ogni 4 secondi quella bussata risultava NUOVA, la campana
 *  suonava, e — poiché i suoni del consulente vengono rigenerati anche sul
 *  dispositivo del cliente — il cliente sentiva un campanello ogni 4 secondi.
 *  Ad annunciare se stesso.
 *
 *  ⚠️ LA CHIAVE È IL DISPOSITIVO **OPPURE** IL PID. Il pid cambia a ogni
 *   ricaricamento della pagina, quindi da solo non basta a riconoscere chi
 *   torna; ma quando il dispositivo non si può leggere è l'unica cosa che
 *   resta, ed è comunque stabile per tutta l'attesa — cioè esattamente per la
 *   durata in cui la campana non deve risuonare.
 *  ⚠️ QUI NON SI SUONA E NON SI SCRIVE NIENTE: si risponde a una domanda.
 *   Serve perché la risposta si possa provare senza aprire due browser e
 *   aspettare quattro secondi (vedi proveDellaBussata).
 *  ───────────────────────────────────────────────────────────────────────── */

/** Come finisce una bussata. Una sola di queste fa suonare la campana. */
export type EsitoBussata =
  /** dispositivo bloccato: non entra e non si annuncia */
  | "bloccato"
  /** già fatto entrare in questa consulenza: si riapre la porta in silenzio */
  | "giaAmmesso"
  /** sta già aspettando: la riga si aggiorna, la campana NON risuona */
  | "giaInAttesa"
  /** è la prima volta: questa — e solo questa — suona */
  | "nuovo";

/** Con che cosa si riconosce chi bussa: il dispositivo se c'è, altrimenti il
 *  pid. Stringa vuota se non c'è né l'uno né l'altro (non dovrebbe capitare:
 *  chi bussa manda sempre il pid). */
export function chiaveBussata(dev?: string | null, pid?: string | null): string {
  return String(dev || "").trim() || String(pid || "").trim();
}

export function esitoBussata(p: {
  dev?: string | null;
  pid?: string | null;
  /** i dispositivi bloccati dal consulente */
  bloccati?: Set<string>;
  /** chi è già stato fatto entrare in questa consulenza (per chiave) */
  ammessi?: Set<string>;
  /** chi è in sala d'attesa adesso */
  inAttesa?: { pid?: string; dev?: string }[];
}): EsitoBussata {
  const dev = String(p.dev || "").trim();
  const pid = String(p.pid || "").trim();
  //  ⚠️ Il blocco si fa SOLO sul dispositivo: bloccare un pid vorrebbe dire
  //   bloccare una scheda del browser, che al ricaricamento successivo è già
  //   un'altra — cioè una porta che si riapre da sola.
  if (dev && p.bloccati?.has(dev)) return "bloccato";
  const chiave = chiaveBussata(dev, pid);
  if (chiave && p.ammessi?.has(chiave)) return "giaAmmesso";
  const gia = (p.inAttesa ?? []).some((k) => {
    const kdev = String(k.dev || "").trim();
    //  Stesso dispositivo = stessa persona, anche se ha ricaricato la pagina.
    if (dev && kdev && dev === kdev) return true;
    //  Senza dispositivo resta il pid: vale per tutta l'attesa, che è quanto
    //  basta perché la campana non risuoni ogni quattro secondi.
    return !!pid && String(k.pid || "").trim() === pid;
  });
  return gia ? "giaInAttesa" : "nuovo";
}
