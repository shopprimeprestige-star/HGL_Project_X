/** ── LE MIGRAZIONI DEL NEGOZIO NON CONTANO NELLE PROVE «SONO L'ULTIMA» ─────────
 *  Shop R1 · T01b. Molte prove di vecchie commesse pretendono «la mia migrazione viene dopo tutte le altre».
 *  Le migrazioni della commessa shop-completo (S1, S2, S3: prefisso 20261120; D40: 20261121) hanno il loro ordine e vengono
 *  dopo, come già fanno le altre eccezioni elencate a mano in quelle prove. Un posto solo da cambiare, se la
 *  commessa avrà migrazioni con un'altra data (es. Rilascio 2). Le altre (anche `ecommerce_ordini`, 20261117) restano severe. */
export const PREFISSI_NEGOZIO = ["20261120", "20261121"]; // 20261121: D40 (Invisible Derm senza prezzo nel trigger), T32 fase 2
export const delNegozio = (nome) => PREFISSI_NEGOZIO.some((p) => nome.startsWith(p));
