/** ── LA MODALITÀ «CERTA», PER IL CARRELLO (T21) ──────────────────────────────
 *  Solo l'involucro `createServerFn` di `modalita-certa.ts` (che è puro e provato): collega `supabaseAdmin` e `SHOP_CATALOGO_FORZA`.
 *  Risponde `codice`, `cms` oppure `incerto`; mai un errore. La risposta non si tiene in nessuna memoria (`no-store`):
 *  serve a decidere se togliere righe dal carrello di un cliente, e una risposta vecchia sarebbe peggio di nessuna.
 *  Funzione separata da `catalogo.functions.ts` (di T11): non ne cambia le intestazioni né la memoria breve. */
import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import type { ClienteDb } from "./catalogo.server";
import { leggiModalitaCerta, type ModalitaCerta } from "./modalita-certa";

export const modalitaCertaDelServer = createServerFn({ method: "POST" }).handler(async (): Promise<ModalitaCerta> => {
  let r: ModalitaCerta = "incerto";
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    r = await leggiModalitaCerta({ db: supabaseAdmin as unknown as ClienteDb, forza: process.env.SHOP_CATALOGO_FORZA ?? null });
  } catch {
    /* incerto */
  }
  try {
    setResponseHeader("Cache-Control", "no-store");
  } catch {
    /* fuori da una richiesta (prove): niente intestazione */
  }
  return r;
});
