import { createFileRoute } from "@tanstack/react-router";
import { PaginaChatBaileys } from "@/crm/chatwa/PaginaChatBaileys";
import { leggiRicercaChat } from "@/crm/chatwa/stato";

//  `?chat=<id del contatto>`: solo un uuid, mai il numero (D21, come /CRM/whatsapp).
//  Qualunque altra cosa viene ignorata e si vede l'elenco.
export const Route = createFileRoute("/CRM/whatsapp-baileys")({
  validateSearch: (raw) => leggiRicercaChat(raw),
  component: PaginaChatBaileys,
});
