import { createFileRoute } from "@tanstack/react-router";
import { PaginaCruscotto } from "@/crm/cruscotto-wa/PaginaCruscotto";

//  Cruscotto WhatsApp (pacchetto p4-cruscotto-wa): numeri del giro WhatsApp.
export const Route = createFileRoute("/CRM/cruscotto-wa")({
  head: () => ({ meta: [{ title: "Cruscotto WhatsApp — CRM" }] }),
  component: PaginaCruscotto,
});
