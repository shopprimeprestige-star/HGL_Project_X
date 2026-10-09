/** ─────────────────────────────────────────────────────────────────────────
 *  /CRM/installazioni — il ramo delle pose
 *
 *  PERCHÉ ESISTE UN FILE CHE NON DISEGNA NIENTE
 *  Le pose sono due schermate della stessa cosa — l'elenco completo e la
 *  giornata di oggi — e prima erano due indirizzi scollegati (`installazioni`,
 *  `installazioni-oggi`) che il trattino faceva sembrare pagine diverse. Adesso
 *  stanno sotto lo stesso ramo (`/installazioni`, `/installazioni/oggi`) e
 *  l'indirizzo racconta la gerarchia da solo.
 *  ⚠️ Il ramo aveva una terza figlia, `/installazioni/agenda`: è stata tolta
 *  insieme alla voce «Agenda posa». Non è nascosta, non risponde più — chi
 *  arriva con un vecchio segnalibro finisce sulla pagina degli indirizzi
 *  sbagliati (routes/CRM.$.tsx), non su una schermata vuota.
 *
 *  Questo file è il nodo del ramo: dichiarato per non lasciare le pagine figlie
 *  senza un padre esplicito. Non aggiunge intestazioni né margini — ogni pagina
 *  si disegna per intero da sé — quindi si limita a un Outlet.
 *  ───────────────────────────────────────────────────────────────────────── */

import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/CRM/installazioni")({
  component: RamoInstallazioni,
});

function RamoInstallazioni() {
  return <Outlet />;
}
