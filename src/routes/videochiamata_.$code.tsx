// ── INDIRIZZO STORICO DELLA STANZA → MEETLY ─────────────────────────────────
//  /videochiamata/kfr-mbqd-tzp  →  /meetly/kfr-mbqd-tzp
//
//  Il software si chiama Meetly e la stanza vive lì. Questo indirizzo resta in
//  piedi per un motivo solo, e non è nostalgia: ai clienti sono GIÀ stati mandati
//  link con la vecchia forma, su WhatsApp e per email. Un link rotto non è un
//  fastidio, è una consulenza che salta.
//
//  Qui non c'è nulla da vedere: si rimanda alla stanza vera prima ancora di
//  disegnare qualcosa (`beforeLoad`), quindi il cliente non vede il salto.
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/videochiamata_/$code")({
  beforeLoad: ({ params, location }) => {
    // ⚠️ TUTTO quello che sta dopo il "?" va conservato, non è decorazione:
    //  ?watch= porta il codice della consulenza nei link della forma più
    //  vecchia, ?client=1 dice che è il dispositivo del cliente, ?debug=1 tiene
    //  aperta la diagnostica. Perderli qui significa far atterrare il cliente in
    //  una stanza muta — e non avrebbe modo di capire perché.
    const coda = `${location.searchStr || ""}${location.hash ? `#${location.hash}` : ""}`;
    //  301 e non 307: l'indirizzo nuovo è quello definitivo, e i programmi di
    //  messaggistica che rileggono il link ne prendono atto una volta sola.
    throw redirect({ href: `/meetly/${encodeURIComponent(params.code)}${coda}`, statusCode: 301 });
  },
});
