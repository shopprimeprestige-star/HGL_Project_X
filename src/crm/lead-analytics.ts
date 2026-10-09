import { eChiusuraVinta, type Lead } from "@/crm/types";

/**
 * Ricavo riconosciuto per un lead.
 *
 * Priorità (dalla più definitiva alla più speculativa):
 *  1. `prezzoFinaleVendita` — prezzo realmente incassato (post-trattativa).
 *  2. `prezzoTotale` — prezzo concordato (pre-saldo).
 *  3. `accontoPagato > 0` → ricavo stimato = `costoProdotto` (proxy minimo
 *     ragionevole quando manca il prezzo totale ma il cliente ha versato
 *     l'acconto, quindi l'ordine è confermato). Fallback: `accontoPagato`.
 *  4. Altrimenti 0 (lead non monetizzato).
 *
 * Nota: NON usiamo `accontoPagato` come ricavo perché sarebbe sotto-stimato
 * — l'acconto è una frazione del prezzo totale, non il ricavo.
 */
export function leadRevenue(lead: Pick<Lead, "data">): number {
  const payment = lead.data.payment;
  if (!payment) return 0;

  // 1. Prezzo finale (post-trattativa)
  if (payment.prezzoFinaleVendita && payment.prezzoFinaleVendita > 0) {
    return payment.prezzoFinaleVendita;
  }
  // 2. Prezzo totale concordato
  if (payment.prezzoTotale && payment.prezzoTotale > 0) {
    return payment.prezzoTotale;
  }
  // 3. Solo acconto: usa costoProdotto come proxy minimo, fallback acconto
  if ((payment.accontoPagato || 0) > 0) {
    return payment.costi?.costoProdotto || payment.accontoPagato || 0;
  }
  // 4. Nessun pagamento tracciato
  return 0;
}

export function leadIsConverted(lead: Pick<Lead, "data">): boolean {
  //  ⚠️ QUI L'ELENCO ERA SCRITTO A MANO e conosceva solo il vecchio "venduto".
  //   Le tre chiusure di oggi (nel nostro centro / a domicilio / da spedire) non
  //   ci passavano: una vendita chiusa con l'acconto a zero — «paga tutto alla
  //   consegna», che è un caso normale — risultava NON convertita, quindi fuori
  //   dall'attribuzione pubblicitaria e senza data di conversione. Il lead
  //   dell'acconto la salvava per caso, con la riga qui sotto: cioè il conteggio
  //   dipendeva da come aveva pagato il cliente, non da se aveva comprato.
  //   `eChiusuraVinta` è l'elenco unico di types.ts: una quarta chiusura entra
  //   da sola.
  if (eChiusuraVinta(lead.data.stato) || lead.data.stato === "concluso") return true;
  return (lead.data.payment?.accontoPagato || 0) > 0;
}

export function leadAttributionDate(lead: Pick<Lead, "data" | "created_at">): Date | null {
  const raw = lead.data.createdAt || lead.created_at;
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Data in cui il lead è stato CONVERTITO (acconto/venduto/concluso).
 * Usa `data.convertedAt` se presente (settato automaticamente al passaggio
 * di stato in CRMContext), fallback su `updated_at` se il lead è convertito.
 * Ritorna null per lead non convertiti.
 */
export function leadConversionDate(lead: Pick<Lead, "data" | "updated_at">): Date | null {
  if (!leadIsConverted(lead)) return null;
  const raw = lead.data.convertedAt || lead.updated_at;
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function shouldDispatchLeadToAds(lead: Pick<Lead, "data">): boolean {
  const tracking = lead.data.tracking;
  return Boolean(
    lead.data.fonte === "ADV" ||
      lead.data.piattaformaAds === "meta" ||
      lead.data.piattaformaAds === "tiktok" ||
      tracking?.source ||
      tracking?.fbp ||
      tracking?.fbc ||
      tracking?.ttclid ||
      tracking?.utm_source ||
      tracking?.utm_campaign,
  );
}
