/** IMMAGINE DELL'ANTEPRIMA — indirizzo storico, prima che il software si
 *  chiamasse Meetly. Non è un doppione da ripulire: le anteprime dei link già
 *  mandati sono in cache nei server di WhatsApp, Messenger e compagnia, e
 *  puntano ancora qui. Se questo indirizzo smette di rispondere, quei messaggi
 *  mostrano un riquadro rotto per un link che invece funziona benissimo.
 *  La logica è una sola, e vive in api.og.meetly.ts.
 */
import { createFileRoute } from "@tanstack/react-router";
import { immagineAnteprimaMeetly } from "./api.og.meetly";

export const Route = createFileRoute("/api/og/videochiamata")({
  server: {
    handlers: {
      GET: async () => immagineAnteprimaMeetly(),
    },
  },
});
