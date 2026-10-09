/* ── IL SERVICE WORKER DELLE NOTIFICHE ───────────────────────────────────────
 *
 *  PERCHÉ ESISTE
 *  Sul telefono `new Notification(...)` non funziona: su Chrome per Android
 *  LANCIA un errore, e su iPhone l'oggetto `Notification` non esiste proprio
 *  finché il sito non è stato aggiunto alla schermata Home. L'unica strada che
 *  un telefono accetta è `registration.showNotification(...)`, cioè QUESTO
 *  file. Senza, il CRM calcolava gli avvisi correttamente e non ne mostrava
 *  nessuno: da fuori è esattamente "le notifiche non arrivano".
 *
 *  COSA NON FA, DI PROPOSITO
 *  Non mette NIENTE in cache. Un service worker che serve pagine dalla propria
 *  cache è il modo più rapido per far vedere a un consulente i dati di ieri, e
 *  l'HTML di questo progetto è già dichiarato `no-cache` apposta (`_headers` e
 *  gli header della rotta radice). Qui si fanno solo le notifiche.
 *
 *  ⚠️ COSA MANCA PER LE NOTIFICHE A TELEFONO CHIUSO
 *  Il gestore `push` qui sotto è pronto ma DORMIENTE: non riceverà mai niente
 *  finché non esiste un servizio che le manda dal server (chiavi VAPID +
 *  `pushManager.subscribe` + un endpoint che spedisce). Oggi le notifiche
 *  nascono nella pagina, quindi arrivano solo mentre il CRM è aperto. È scritto
 *  anche nella pagina Notifiche, perché nessuno resti ad aspettare un avviso
 *  che non può partire.
 *  ────────────────────────────────────────────────────────────────────────── */

/** Cambiare questo numero è il modo di forzare l'aggiornamento del worker sui
 *  dispositivi che ce l'hanno già installato: il file cambia, il browser se ne
 *  accorge e reinstalla. */
const VERSIONE = "hg-notifiche-1";

/** Il canale dei messaggi verso la pagina. Un nome esplicito perché sulla
 *  stessa origine possono viaggiare messaggi di altri (estensioni, strumenti di
 *  sviluppo): chi ascolta deve poter scartare quello che non lo riguarda. */
const CANALE = "hg-notifiche";

// Il worker nuovo prende servizio subito, senza aspettare che si chiudano tutte
// le schede aperte. Aspettare significherebbe che dopo una pubblicazione le
// notifiche restano ferme alla versione vecchia per giorni.
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

/* ── MOSTRARE UNA NOTIFICA SU RICHIESTA DELLA PAGINA ───────────────────────── */

/** La pagina normalmente chiama `registration.showNotification` da sé. Questo
 *  gestore serve al caso in cui il worker sia attivo ma la pagina non abbia
 *  ancora in mano la registrazione (primo avvio, aggiornamento in corso): il
 *  messaggio arriva comunque a destinazione invece di perdersi. */
self.addEventListener("message", (event) => {
  const m = event.data;
  if (!m || m.canale !== CANALE) return;

  if (m.tipo === "mostra" && m.titolo) {
    event.waitUntil(self.registration.showNotification(m.titolo, m.opzioni || {}));
    return;
  }
  if (m.tipo === "versione") {
    event.source?.postMessage({ canale: CANALE, tipo: "versione", versione: VERSIONE });
  }
});

/* ── IL CLIC SULLA NOTIFICA ────────────────────────────────────────────────── */

/** ── PERCHÉ IL CLIC PASSA DI QUI E NON DA `n.onclick` ───────────────────────
 *  Una notifica mostrata dal service worker NON esegue l'`onclick` scritto
 *  nella pagina: quella funzione vive in una scheda che al momento del clic può
 *  benissimo essere chiusa. Il clic arriva qui, e da qui si fa la cosa giusta
 *  nell'ordine giusto:
 *    1. c'è già una finestra del CRM aperta? la si porta davanti e le si dice
 *       cosa aprire — così chi stava guardando l'agenda non perde il posto;
 *    2. non c'è nessuna finestra del CRM? se ne apre una direttamente sulla
 *       pagina giusta.
 *  Il caso 2 è quello vero sul telefono, dove il CRM viene chiuso di continuo.
 *
 *  ⚠️ «FINESTRA DEL CRM», NON «FINESTRA DI QUESTO SITO». Su questa stessa
 *  origine vive anche il sito pubblico (negozio, preventivi, presentazioni).
 *  Portare davanti la prima scheda della stessa origine significava, per chi ha
 *  il negozio aperto e il CRM chiuso, ritrovarsi il negozio in faccia e nessun
 *  avviso aperto: quella pagina non ascolta questo messaggio e non ha il router
 *  del CRM. Si cerca quindi una finestra sotto `/CRM`, e solo se non ce n'è si
 *  apre la pagina giusta da capo.
 *  ────────────────────────────────────────────────────────────────────────── */

/** Una finestra del CRM, non una qualunque di questa origine. */
function eDelCrm(finestra) {
  try {
    const u = new URL(finestra.url);
    if (u.origin !== self.location.origin) return false;
    return u.pathname === "/CRM" || u.pathname.startsWith("/CRM/");
  } catch {
    return false;
  }
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const dati = event.notification.data || {};
  const destinazione = typeof dati.destinazione === "string" ? dati.destinazione : "/CRM";

  event.waitUntil(
    (async () => {
      let finestre = [];
      try {
        finestre = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      } catch {
        /* alcuni browser lo negano in casi limite: si passa all'apertura */
      }

      for (const f of finestre) {
        if (!eDelCrm(f)) continue;

        try {
          if ("focus" in f) await f.focus();
        } catch {
          /* la finestra può essere sparita fra matchAll e focus */
        }
        // La pagina sa aprire la scheda del lead SOPRA quello che si sta
        // guardando: si lascia decidere a lei, che ha il router in mano.
        f.postMessage({ canale: CANALE, tipo: "clic", dati });
        return;
      }

      // Nessuna finestra del CRM viva: si parte dalla pagina di destinazione.
      // Il lead da aprire viaggia nell'indirizzo, perché non c'è nessuno a cui
      // dirlo a voce.
      let url = destinazione;
      if (dati.leadId && dati.quantita === 1) {
        url += (url.includes("?") ? "&" : "?") + "lead=" + encodeURIComponent(dati.leadId);
      }
      try {
        await self.clients.openWindow(url);
      } catch {
        /* niente da fare: il browser ha rifiutato l'apertura */
      }
    })(),
  );
});

/* ── LE NOTIFICHE DAL SERVER (non attive) ──────────────────────────────────── */

/** ⚠️ DORMIENTE. Perché scatti serve, dalla parte del server:
 *    · una coppia di chiavi VAPID;
 *    · `pushManager.subscribe()` nella pagina e l'iscrizione salvata a database;
 *    · un processo che, quando succede qualcosa, spedisce il messaggio.
 *  Nessuno dei tre esiste oggi. Il gestore resta qui perché il giorno in cui
 *  quel servizio verrà scritto questa parte è già al posto giusto — non perché
 *  faccia qualcosa adesso. */
self.addEventListener("push", (event) => {
  let dati = {};
  try {
    dati = event.data ? event.data.json() : {};
  } catch {
    dati = { titolo: "Hair Genius CRM", corpo: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(dati.titolo || "Hair Genius CRM", {
      body: dati.corpo || "",
      icon: "/icone/hg-192.png",
      badge: "/icone/hg-192.png",
      tag: dati.chiave || undefined,
      data: dati,
    }),
  );
});
