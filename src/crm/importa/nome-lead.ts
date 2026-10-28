/** Estratto da `src/routes/CRM.importa.tsx` (commessa 2026-10-28-lead-importati-semplice,
 *  compito T3): il nome che si scrive nei messaggi.
 *  Solo uno spostamento: nessuna riga di logica è cambiata. */
import { type Lead } from "@/crm/types";

/** Il nome che si scrive nei messaggi. Il ripiego cambia con la frase, ed è per
 *  questo che è un argomento: da solo in un messaggio è «Il contatto» («Il
 *  contatto è stato messo da parte»), dentro un elenco di nomi è «senza nome»
 *  («Rossi, senza nome, Bianchi: sono rimaste com'erano»). La regola sotto è
 *  sempre la stessa — nome e cognome, e se non c'è né l'uno né l'altro si dice
 *  qualcosa invece di lasciare una frase che comincia con uno spazio. */
export function nomeDi(l: Lead, ripiego = "Il contatto"): string {
  return `${l.data?.nome || ""} ${l.data?.cognome || ""}`.trim() || ripiego;
}
