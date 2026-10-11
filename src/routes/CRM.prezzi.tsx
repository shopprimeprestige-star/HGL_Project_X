/** ─────────────────────────────────────────────────────────────────────────
 *  /CRM/prezzi — TRASFERITO IN MEETLY
 *
 *  Qui c'era il listino del preventivo: la pagina con la modifica sul posto, la
 *  conferma prima di scrivere, la verifica dopo aver scritto e l'anteprima di
 *  come il prezzo sarebbe apparso al cliente. Non è stato tolto niente: è tutto
 *  nel pannello Impostazioni di Meetly, scheda "Listino"
 *  (shop/SettingsListino.tsx), che è il posto dove quelle cifre vengono
 *  mostrate al cliente.
 *
 *  IL FILE RESTA, E NON È DISORDINE
 *  L'indirizzo è nei preferiti di qualcuno e nella ricerca del gestionale.
 *  Cancellare la rotta significherebbe rispondere con un errore a chi cerca il
 *  listino — peggio di una pagina che spiega dove guardare.
 *
 *  DOV'È FINITO IL CODICE CONDIVISO
 *  Le funzioni che stavano qui ed erano usate anche da /CRM/sconti
 *  (numeroDaTesto, testoDaNumero, percentuale, QUANTITA, calcolaPreventivoTipo…)
 *  vivono adesso in shop/listino-condiviso.ts: nessuna copia, un solo posto in
 *  cui si calcola il totale che vede il cliente.
 *  ───────────────────────────────────────────────────────────────────────── */

import { createFileRoute } from "@tanstack/react-router";
import { Euro } from "lucide-react";
import { RimandoImpostazioniMeetly } from "@/crm/RimandoImpostazioniMeetly";

export const Route = createFileRoute("/CRM/prezzi")({
  component: PaginaPrezziTrasferita,
});

function PaginaPrezziTrasferita() {
  return (
    <RimandoImpostazioniMeetly
      icona={Euro}
      titolo="Prezzi"
      scheda="Listino"
      cosaEra="Il listino del preventivo: quanto costa ogni voce del configuratore, i prezzi barrati delle promozioni e le voci nascoste al cliente."
    />
  );
}
