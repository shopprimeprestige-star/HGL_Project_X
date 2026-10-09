/** ── IL PERMESSO DI NOTIFICARE ─────────────────────────────────────────────
 *
 *  LA REGOLA DA CUI DIPENDE TUTTO
 *  `Notification.requestPermission()` si può chiamare una volta sola con esito
 *  utile. Se l'utente nega, il browser NON ripropone più la richiesta: da quel
 *  momento l'unico modo per riattivare le notifiche è entrare nelle
 *  impostazioni del sito a mano. E una richiesta che compare da sola appena si
 *  apre il CRM, senza che nessuno l'abbia chiesta, viene negata quasi sempre —
 *  è un pop-up di sistema che interrompe.
 *
 *  DA QUI LE DUE REGOLE DI QUESTO FILE
 *   1. la richiesta parte SOLO da `chiediPermesso()`, che si invoca solo da un
 *      clic su un pulsante che ha appena spiegato a cosa serve;
 *   2. nessun altro punto del codice chiama `requestPermission`.
 *
 *  Quando il permesso è già stato negato non si insiste: si spiega, in
 *  italiano, come riaprirlo dalle impostazioni del browser.
 *  ───────────────────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useState } from "react";
import { serveInstallazione, suApple } from "./canale-sistema";

// La notifica di prova vive nel canale di sistema insieme a quelle vere: deve
// passare per la stessa strada, altrimenti su telefono si proverebbe una cosa
// diversa da quella che si usa. Ri-esportata da qui perché è da qui che il
// resto del CRM l'ha sempre chiamata.
export { notificaDiProva } from "./canale-sistema";

export type StatoPermesso =
  /** Il browser non conosce le notifiche (o siamo in rendering server). */
  | "non_supportato"
  /** Mai chiesto: il pulsante "Attiva le notifiche" ha senso. */
  | "da_chiedere"
  | "concesso"
  /** Negato: non si può più chiedere, si può solo spiegare. */
  | "negato";

export function supportate(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function statoPermesso(): StatoPermesso {
  if (!supportate()) return "non_supportato";
  const p = window.Notification.permission;
  if (p === "granted") return "concesso";
  if (p === "denied") return "negato";
  return "da_chiedere";
}

/** Da chiamare SOLO dentro il gestore di un clic. */
export async function chiediPermesso(): Promise<StatoPermesso> {
  if (!supportate()) return "non_supportato";
  if (window.Notification.permission !== "default") return statoPermesso();
  try {
    // Safari nelle versioni vecchie usa la forma con callback e non ritorna una
    // Promise: si accetta entrambe senza rompere nulla.
    const esito = await new Promise<NotificationPermission>((risolvi) => {
      const r = window.Notification.requestPermission((v) => risolvi(v));
      if (r && typeof (r as Promise<NotificationPermission>).then === "function") {
        void (r as Promise<NotificationPermission>).then(risolvi);
      }
    });
    return esito === "granted" ? "concesso" : esito === "denied" ? "negato" : "da_chiedere";
  } catch {
    return statoPermesso();
  }
}

/** Le quattro frasi da mostrare all'utente. Niente gergo: "default",
 *  "granted" e "denied" non dicono nulla a chi deve solo lavorare. */
const SPIEGAZIONE_BASE: Record<StatoPermesso, { titolo: string; testo: string }> = {
  non_supportato: {
    titolo: "Questo browser non supporta le notifiche",
    testo:
      "Gli avvisi restano visibili nella campanella in alto e in questa pagina, ma non compariranno sulla scrivania.",
  },
  da_chiedere: {
    titolo: "Notifiche non ancora attive",
    testo:
      "Il browser chiederà il permesso una volta sola. Serve per farti arrivare gli avvisi anche quando il CRM è in secondo piano.",
  },
  concesso: {
    titolo: "Notifiche attive",
    testo:
      "Gli avvisi arrivano sulla scrivania anche con il CRM in secondo piano, con un suono breve.",
  },
  negato: {
    titolo: "Notifiche bloccate da questo browser",
    testo:
      "Il permesso è stato negato e non può essere richiesto di nuovo dalla pagina. Riattivalo dall'icona del lucchetto accanto all'indirizzo del sito, alla voce Notifiche, poi ricarica.",
  },
};

/** ── IL CASO IPHONE, CHE NON È "BROWSER VECCHIO" ────────────────────────────
 *  Su iPhone e iPad, finché il CRM è una scheda di Safari, l'oggetto
 *  `Notification` NON ESISTE: `statoPermesso()` risponde "non supportato", ed è
 *  tecnicamente vero ma praticamente una bugia. Non è un browser scarso: è che
 *  Apple pretende che il sito venga prima aggiunto alla schermata Home. La frase
 *  generica mandava l'utente a cercare un altro browser — non esiste, su iPhone
 *  sono tutti lo stesso motore — invece che a fare il gesto che risolve.
 *
 *  ⚠️ `montato` NON è un dettaglio. Le frasi qui sotto dipendono da `navigator`
 *  e da `matchMedia`, che sul server non esistono: disegnare la pagina sul
 *  server con la frase generica e ridisegnarla nel browser con quella
 *  dell'iPhone fa saltare l'idratazione di React proprio su questo riquadro.
 *  Chi chiama passa `false` finché il componente non è montato, e riceve la
 *  frase neutra — la stessa che ha disegnato il server.
 *  ───────────────────────────────────────────────────────────────────────── */
export function spiegazione(
  stato: StatoPermesso,
  montato = false,
): { titolo: string; testo: string } {
  if (!montato) return SPIEGAZIONE_BASE[stato];
  if (stato === "non_supportato" && serveInstallazione()) {
    return {
      titolo: "Aggiungi il CRM alla schermata Home",
      testo:
        "Su iPhone e iPad le notifiche di un sito arrivano solo se è stato aggiunto alla schermata Home. Dal menù Condividi di Safari scegli «Aggiungi a Home», riapri il CRM dall'icona e torna qui: il pulsante per attivarle comparirà.",
    };
  }
  if (stato === "non_supportato" && suApple()) {
    return {
      titolo: "Notifiche non disponibili in questa versione di iOS",
      testo:
        "Le notifiche dei siti web richiedono iOS 16.4 o successivo. Gli avvisi restano nella campanella in alto e in questa pagina.",
    };
  }
  return SPIEGAZIONE_BASE[stato];
}

/** Lo stato del permesso come stato React, aggiornato quando cambia davvero.
 *  `Permissions.query` avvisa anche quando l'utente lo cambia dalle
 *  impostazioni del browser mentre la pagina è aperta: senza, la schermata
 *  continuerebbe a dire "bloccate" dopo che sono state sbloccate. */
export function usePermesso() {
  const [stato, setStato] = useState<StatoPermesso>("non_supportato");
  const [inCorso, setInCorso] = useState(false);

  const ricontrolla = useCallback(() => setStato(statoPermesso()), []);

  useEffect(() => {
    ricontrolla();
    let stato: PermissionStatus | null = null;
    const alCambio = () => ricontrolla();
    if (typeof navigator !== "undefined" && navigator.permissions?.query) {
      navigator.permissions
        .query({ name: "notifications" as PermissionName })
        .then((s) => {
          stato = s;
          s.addEventListener("change", alCambio);
        })
        .catch(() => {
          /* Firefox su alcune versioni non espone "notifications": pazienza */
        });
    }
    const alRitorno = () => {
      if (document.visibilityState === "visible") ricontrolla();
    };
    document.addEventListener("visibilitychange", alRitorno);
    return () => {
      stato?.removeEventListener("change", alCambio);
      document.removeEventListener("visibilitychange", alRitorno);
    };
  }, [ricontrolla]);

  const chiedi = useCallback(async () => {
    setInCorso(true);
    try {
      const esito = await chiediPermesso();
      setStato(esito);
      return esito;
    } finally {
      setInCorso(false);
    }
  }, []);

  return { stato, chiedi, inCorso, ricontrolla };
}
