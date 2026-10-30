/** ── LA SCHEDA CHE NASCE DA UNA CHAT (30/10/2026) ────────────────────────────
 *
 *  Richiesta del titolare: sulle chat senza scheda il tasto dello stato apre lo stesso selettore
 *  e, alla scelta, crea la scheda (col numero, origine «WhatsApp») e le dà lo stato.
 *
 *  Pura: niente React né Supabase. Il salvataggio è `createLead` del CRM, il cambio di stato è
 *  `cambiaStatoLead` (useChatWa): stesse regole, stesse finestre del resto del CRM.
 *  ───────────────────────────────────────────────────────────────────────── */
import type { LeadData } from "@/crm/types";

export const ORIGINE_SCHEDA_DA_CHAT = "WhatsApp";

/** I dati della scheda nuova: il numero della chat, il nome salvato sul contatto (se c'è), stato di
 *  partenza «Da contattare» (poi lo cambia `cambiaStatoLead`).
 *  shortcut: `fonte` è «Organico» perché fra le quattro fonti del CRM non c'è «WhatsApp» (aggiungerla
 *  tocca report e inserzioni), e NON «ADV» per non finire nei conti delle inserzioni; l'origine
 *  vera sta nelle note. Da cambiare se il titolare vuole «WhatsApp» come quinta fonte. */
export function schedaDaChat(
  chat: { phone: string; contact?: { display_name?: string | null } | null },
  ora: Date = new Date(),
): LeadData {
  return {
    nome: (chat.contact?.display_name ?? "").trim(),
    cognome: "",
    telefono: chat.phone,
    fonte: "Organico",
    consulenteId: null,
    stato: "da_contattare",
    highlighted: false,
    note: `Origine: ${ORIGINE_SCHEDA_DA_CHAT}`,
    createdAt: ora.toISOString(),
  };
}
