/** ── FATTURE DALLA CHAT · T1 · CANDIDATI E RICERCA MANUALE ──────────────────
 *  PIANO §2/§4 (T1), SPEC §3 passo 1, §6.1: le due regole pure che servono alla
 *  lista di partenza (passo 1). Qui NON ci sono né la query su `crm_leads` né il
 *  filtro `giaEmessa` (stanno nella rotta, PIANO §4 T1 — «la query vera… e il
 *  filtro giaEmessa stanno nella rotta, non qui»): questo file resta puro,
 *  nessuna dipendenza da Supabase.
 *
 *  La ricerca manuale NON si reimplementa: si adatta una `Lead` alla forma
 *  `ChatCercabile` che `combaciaRicerca` (chatwa/cercaChat.ts) già conosce, e
 *  chi cerca (la rotta, T5) importa e usa quella funzione — mai una copia. */
import type { Lead, PaymentInfo } from "../../types";
import type { ChatCercabile } from "../../chatwa/cercaChat";

/** SPEC §3 passo 1, §6.1: un cliente entra nella lista di partenza se ha un
 *  pagamento già registrato in scheda — acconto versato (>0) o saldo pieno —
 *  indipendentemente dallo stato della pratica (stesso principio del filtro
 *  «Acconto» di `passaFiltro` in cercaChat.ts, che guarda l'importo, non lo
 *  stato). Negata, serve anche ai controlli (PIANO §2): una riga «dalla chat»
 *  senza nessuno dei due non dovrebbe mai nascere da questa lista. */
export function haPagamentoSenzaFattura(
  payment: Pick<PaymentInfo, "accontoPagato" | "statoPagamento"> | null | undefined,
): boolean {
  if (!payment) return false;
  if ((Number(payment.accontoPagato) || 0) > 0) return true;
  return payment.statoPagamento === "pagato_interamente";
}

/** Adatta una `Lead` (crm_leads) alla forma che `combaciaRicerca` si aspetta:
 *  solo nome e cognome della scheda, niente contatto WhatsApp (qui si cerca
 *  fra le schede, non fra le chat — `contact` resta assente). Il telefono
 *  entra così com'è scritto in scheda: `combaciaRicerca` lo confronta già per
 *  cifre, con o senza «+39» o spazi (PIANO §4 T1, prova dedicata). */
export function cercabileDaLead(lead: Lead): ChatCercabile {
  return {
    phone: lead.data.telefono ?? "",
    lead: { data: { nome: lead.data.nome, cognome: lead.data.cognome } },
  };
}
