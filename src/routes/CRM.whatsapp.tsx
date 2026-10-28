import { createFileRoute } from "@tanstack/react-router";
import { PaginaChat } from "@/crm/chatwa/PaginaChat";

export const Route = createFileRoute("/CRM/whatsapp")({
  component: PaginaChat,
});
