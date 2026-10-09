/** ── LA CAUSALE SCRITTA A MANO PER UN PREVENTIVO ───────────────────────────
 *
 *  Richiesta del committente: «fai che posso cambiare la causale del
 *  preventivo».
 *
 *  Il modello di partenza sta nel listino (Impostazioni → Listino) e vale per
 *  i preventivi nuovi. Questa riga è l'eccezione: la causale decisa per UN
 *  preventivo, che vince su quella del listino.
 *
 *  ⚠️ RIGA A PARTE, NON DENTRO LA FOTOGRAFIA DELLE CONDIZIONI. La fotografia
 *   porta il listino intero — prezzi compresi — e riscriverla per cambiare una
 *   frase vorrebbe dire mettere mano ai prezzi di un documento già consegnato.
 *   Una riga sola, un solo effetto.
 *  ⚠️ SI SALVA IL MODELLO, NON LA FRASE FINITA: con `{numero}` dentro, un
 *   preventivo che cambia numero continua a citare quello giusto, e la stessa
 *   riga la possono leggere la pagina del cliente e la fattura.
 *  ───────────────────────────────────────────────────────────────────────── */

/** La base della chiave in `app_config`: la riga vera è
 *  `preventivo_causale:<numero>` (vedi `chiaveSessione`). */
export const BASE_CAUSALE = "preventivo_causale";

/** Rilegge la riga difendendosi: una riga rotta non deve lasciare il cliente
 *  senza causale — si torna al modello del listino, che è il comportamento di
 *  prima che questa cosa esistesse. */
export function leggiCausaleSalvata(grezzo?: string | null): string {
  if (!grezzo) return "";
  try {
    const v = JSON.parse(grezzo) as { modello?: unknown };
    return String(v?.modello ?? "").trim();
  } catch {
    return "";
  }
}
