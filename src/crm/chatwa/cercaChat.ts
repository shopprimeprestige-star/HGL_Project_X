/** La ricerca dell'elenco, per conto di `ElencoChat`: nome della scheda, numero e, in più di
 *  `visibili` (useChatWa), il nome salvato dal contatto, così un «numero senza scheda» col
 *  nome di ManyChat si trova per nome. Pura: niente React, niente Supabase. Serve al riquadro
 *  «Da rispondere» e alle «vecchie», che obbediscono alla ricerca ma NON alle pastiglie. */
export interface ChatCercabile {
  phone: string;
  lead?: { data: { nome?: string | null; cognome?: string | null } } | null;
  contact?: { display_name?: string | null } | null;
}

/** La chat combacia con la ricerca? Ricerca vuota = sì. Maiuscole e spazi ai bordi non contano. */
export function combaciaRicerca(c: ChatCercabile, ricerca: string): boolean {
  const q = ricerca.trim().toLowerCase();
  if (!q) return true;
  const nomeScheda = `${c.lead?.data.nome ?? ""} ${c.lead?.data.cognome ?? ""}`.toLowerCase();
  return (
    nomeScheda.includes(q) ||
    c.phone.toLowerCase().includes(q) ||
    (c.contact?.display_name ?? "").toLowerCase().includes(q)
  );
}
