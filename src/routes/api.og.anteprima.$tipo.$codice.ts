/** LA STESSA IMMAGINE, MA CON UN INDIRIZZO CHE FINISCE IN «.jpg»
 *  GET/HEAD /api/og/anteprima/invito/CODICE.jpg
 *
 *  ── PERCHÉ DUE INDIRIZZI PER LA STESSA COSA ───────────────────────────────
 *  L'altra forma (…/anteprima?tipo=invito&c=CODICE) è corretta e risponde
 *  benissimo. Ma dentro l'HTML quell'indirizzo si scrive con l'e commerciale
 *  come entità — `&amp;` — e ogni lettore di anteprime deve decodificarla per
 *  conto suo prima di chiedere l'immagine. Chi non lo fa chiede un indirizzo
 *  con dentro «&amp;tipo=…», riceve una risposta che non è quella attesa e
 *  rinuncia in silenzio.
 *  Un indirizzo tutto nel percorso non ha e commerciali, non ha query da
 *  interpretare, e per giunta finisce con l'estensione giusta: chi decide se
 *  scaricare guardando la fine dell'indirizzo — e qualcuno lo fa ancora — trova
 *  quello che si aspetta.
 *
 *  Il modo di servire è identico: una sola funzione, in api.og.anteprima.
 */
import { createFileRoute } from "@tanstack/react-router";
import { serviAnteprima } from "./api.og.anteprima";
import type { TipoAnteprima } from "./api.anteprima";

/** ⚠️ L'estensione fa parte del nome solo per gli occhi di chi legge
 *  l'indirizzo: qui si toglie prima di cercare il deposito, altrimenti si
 *  cercherebbe «CODICE.jpg» e non si troverebbe mai niente. */
const senzaEstensione = (v: string) => String(v || "").replace(/\.(jpe?g|png)$/i, "");

function tipoValido(v: string): TipoAnteprima | null {
  return v === "invito" || v === "preventivo" || v === "webinar" || v === "capelli" ? v : null;
}

export const Route = createFileRoute("/api/og/anteprima/$tipo/$codice")({
  server: {
    handlers: {
      //  ⚠️ La richiesta si passa per intero: dentro ci sono «ce l'ho già,
      //   è cambiata?» (`If-None-Match`, `If-Modified-Since`), e rispondere
      //   «è la stessa» costa zero byte invece di un'immagine intera.
      HEAD: async ({ params, request }) =>
        serviAnteprima(tipoValido(params.tipo), senzaEstensione(params.codice), true, request),
      GET: async ({ params, request }) =>
        serviAnteprima(tipoValido(params.tipo), senzaEstensione(params.codice), false, request),
    },
  },
});
