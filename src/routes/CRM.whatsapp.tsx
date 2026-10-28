import { createFileRoute } from "@tanstack/react-router";
import { PaginaChat } from "@/crm/chatwa/PaginaChat";
import { leggiRicercaChat } from "@/crm/chatwa/stato";

//  `?chat=<id del contatto>`: solo un uuid, mai il numero (D21). Qualunque altra
//  cosa viene ignorata e si vede l'elenco.
export const Route = createFileRoute("/CRM/whatsapp")({
  validateSearch: (raw) => leggiRicercaChat(raw),
  component: PaginaChat,
});
