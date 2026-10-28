import { createFileRoute, redirect } from "@tanstack/react-router";
import { leggiRicercaChat } from "@/crm/chatwa/stato";

//  Indirizzo corto da salvare sulla Home del telefono: /CRM/chat apre la pagina
//  WhatsApp. È un rimando e non una seconda pagina, così lo stato (la chat
//  aperta) vive in un posto solo. `replace`: nella cronologia non resta una
//  tappa che rimanda altrove, o il tasto indietro diventerebbe un rimbalzo.
//  Il rimando avviene prima che il CRM disegni qualsiasi cosa: login e permessi
//  li applica la pagina vera. Non è nel menu: le rotte del menu sono altre.
export const Route = createFileRoute("/CRM/chat")({
  validateSearch: (raw) => leggiRicercaChat(raw),
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/CRM/whatsapp",
      search: search.chat ? { chat: search.chat } : {},
      replace: true,
    });
  },
});
