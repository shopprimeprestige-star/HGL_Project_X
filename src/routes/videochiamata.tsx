// ── INDIRIZZO STORICO DEL LINK CLIENTE → MEETLY ─────────────────────────────
//  /videochiamata?watch=kfr-mbqd-tzp  →  /meetly?watch=kfr-mbqd-tzp
//
//  È la forma più vecchia di tutte: il codice della consulenza viaggiava dopo il
//  punto interrogativo. Resta valida perché quei link sono in mano ai clienti e
//  non si possono richiamare indietro; il software però si chiama Meetly, e la
//  pagina vera è una sola.
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/videochiamata")({
  beforeLoad: ({ location }) => {
    // ⚠️ Senza la query qui non resta NIENTE: su questa forma il codice della
    //  consulenza sta tutto in ?watch=. Toglierlo vuol dire mandare il cliente
    //  in una sala d'attesa che non si aprirà mai.
    const coda = `${location.searchStr || ""}${location.hash ? `#${location.hash}` : ""}`;
    throw redirect({ href: `/meetly${coda}`, statusCode: 301 });
  },
});
