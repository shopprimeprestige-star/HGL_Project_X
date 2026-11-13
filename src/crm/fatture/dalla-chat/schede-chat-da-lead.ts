/** ── FATTURE DALLA CHAT · T8 · `schedeChat` DA `leads` (PIANO §0bis.2) ──────
 *  T7 (`useLottoChat`) ha lasciato a T8 la costruzione di `opzioni.schedeChat`
 *  (`Record<idRiga, SchedaChat>`, per `valutaLottoChat`/T3): stesso principio
 *  con cui T4 ha lasciato la cablatura vera a T5 — chi scrive l'hook puro non
 *  si lega al modello `Lead`, chi scrive la UI (che il modello lo ha già in
 *  mano via `useCRM()`) fa la traduzione.
 *
 *  Nome/cognome/CF/telefono riusano `schedaDaLead` (bulk, import non copia):
 *  stessa normalizzazione (telefono = ultime 9 cifre) di `contesto.schede`,
 *  la mappa che serve a `bulk/valuta.ts` per «CF diverso dalla scheda» — due
 *  mappe diverse, stessa fonte, mai due modi di leggere la stessa scheda.
 *
 *  `importoScheda` (PIANO §0bis.2, formula scritta dall'architetto):
 *   - l'acconto, se è maggiore di zero (vale anche quando il saldo è già
 *     stato versato per intero: `accontoPagato` è comunque il totale incassato);
 *   - altrimenti, SOLO se la scheda è «pagata per intero» secondo lo stesso
 *     criterio di `haPagamentoSenzaFattura` (T1, candidati.ts — importato, non
 *     reinventato: «che importo guardare» si decide in un punto solo), il
 *     prezzo finale di vendita (o il prezzo totale, se quello manca);
 *   - altrimenti `null`: nessun pagamento noto da confrontare con il bonifico
 *     (SPEC §5), non uno zero inventato. */
import type { Lead, PaymentInfo } from "../../types";
import { schedaDaLead } from "../bulk/scheda-da-lead";
import { haPagamentoSenzaFattura } from "./candidati";
import type { SchedaChat } from "./valuta-chat";

function importoSchedaDi(payment: PaymentInfo | null | undefined): number | null {
  const acconto = Number(payment?.accontoPagato) || 0;
  if (acconto > 0) return acconto;
  if (!haPagamentoSenzaFattura(payment)) return null;
  const finale = Number(payment?.prezzoFinaleVendita) || Number(payment?.prezzoTotale) || 0;
  return finale > 0 ? finale : null;
}

/** Una `Lead` del CRM → `SchedaChat` (PIANO §0bis.2). Pura: nessun accesso a
 *  database o a sessione. */
export function schedaChatDaLead(lead: Lead): SchedaChat {
  const d = lead.data as { payment?: PaymentInfo } | undefined;
  return {
    ...schedaDaLead(lead.id, lead.data ?? {}),
    importoScheda: importoSchedaDi(d?.payment ?? null),
  };
}

/** `leads` → `Record<idRiga, SchedaChat>` (`idRiga` = `schedaId` = `lead.id`, PIANO §0.1):
 *  un lead senza id (difesa: non dovrebbe mai succedere) non entra nella mappa. */
export function schedeChatDaLeads(leads: readonly Lead[]): Record<string, SchedaChat> {
  const out: Record<string, SchedaChat> = {};
  for (const l of leads) if (l?.id) out[l.id] = schedaChatDaLead(l);
  return out;
}
