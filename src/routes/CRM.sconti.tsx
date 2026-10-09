/** ─────────────────────────────────────────────────────────────────────────
 *  /CRM/sconti — TRASFERITO IN MEETLY
 *
 *  Questa pagina e il pannello di Meetly configuravano LA STESSA COSA: i codici
 *  della tabella `discount_codes` e gli sconti per quantità in `app_config`
 *  (chiave 'qty_discounts'). Due schermate diverse che scrivevano sulle stesse
 *  righe sono due modi di scoprire troppo tardi quale delle due era aggiornata.
 *
 *  È rimasta quella di Meetly, che ha però ereditato tutto quello che sapeva
 *  fare solo questa: la bozza per riga, la conferma con il prima → dopo, la
 *  rilettura dopo il salvataggio, la percentuale di ogni sconto sul preventivo
 *  tipo, l'avviso quando gli sconti automatici si mangiano un preventivo intero,
 *  l'anteprima del riquadro posti come lo legge il cliente e la conferma prima
 *  di eliminare un codice. Sta in shop/SettingsSconti.tsx, scheda "Sconti e
 *  coupon".
 *
 *  IL FILE RESTA perché l'indirizzo è nei preferiti e nella ricerca del CRM:
 *  chi ci arriva deve leggere dove sono finiti gli sconti, non un errore.
 *  ───────────────────────────────────────────────────────────────────────── */

import { createFileRoute } from "@tanstack/react-router";
import { Ticket } from "lucide-react";
import { RimandoImpostazioniMeetly } from "@/crm/RimandoImpostazioniMeetly";

export const Route = createFileRoute("/CRM/sconti")({
  component: PaginaScontiTrasferita,
});

function PaginaScontiTrasferita() {
  return (
    <RimandoImpostazioniMeetly
      icona={Ticket}
      titolo="Sconti"
      scheda="Sconti e coupon"
      cosaEra="I codici sconto (valore, posti, testi mostrati al cliente) e gli sconti automatici per quantità."
    />
  );
}
