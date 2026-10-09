/** ── OGNI QUANTO SI CHIEDE COM'È LA SALA ───────────────────────────────────
 *
 *  ⚠️ IL RITARDO ERA LA SOMMA DI DUE COSE, e correggerne una sola non si
 *   sarebbe visto: la risposta restava in cache al bordo tre secondi, e la
 *   sala la richiedeva ogni tre secondi e mezzo. Nel caso peggiore fra il
 *   gesto di chi conduce e lo schermo di chi guarda passavano sei secondi e
 *   mezzo. Su una slide è fastidioso; su un dibattito, dove chi guarda sente
 *   la voce prima di vedere il montaggio cambiare, è proprio sbagliato — il
 *   video passa dalla diretta e arriva subito, il montaggio no.
 *
 *  ⚠️ MA CHIEDERE SEMPRE IN FRETTA NON SI PUÒ. Cinquecento spettatori che
 *   chiedono ogni secondo sono cinquecento letture al secondo sul database, e
 *   la cache del bordo esiste apposta per non farle. La via d'uscita non è un
 *   numero più piccolo: è chiedere in fretta SOLO quando serve davvero.
 *
 *   · IN ONDA E CON LA PAGINA DAVANTI — un secondo scarso. È l'unico momento
 *     in cui un ritardo si vede: sta succedendo qualcosa e lo si sta guardando.
 *   · IN ONDA MA CON LA PAGINA DIETRO — otto secondi. Il telefono in tasca
 *     durante una diretta di un'ora è il caso più comune di tutti, e lì stiamo
 *     spendendo richieste per aggiornare uno schermo spento.
 *   · PRIMA CHE COMINCI — due secondi e mezzo. Si aspetta l'unica cosa che può
 *     succedere, e quando succede è bello vederla subito.
 *   · TUTTO IL RESTO (finita, sala inesistente, errore) — sei secondi. Non c'è
 *     più niente da vedere cambiare.
 */
export const RITMO = {
  ondaDavanti: 900,
  ondaDietro: 8000,
  attesa: 2500,
  fermo: 6000,
} as const;

export function ritmoDelGiro(o: { fase: string; visibile: boolean }): number {
  if (o.fase === "onda") return o.visibile ? RITMO.ondaDavanti : RITMO.ondaDietro;
  if (o.fase === "attesa" || o.fase === "pronto" || o.fase === "cerco" || o.fase === "collego") {
    //  ⚠️ Anche qui la pagina dietro conta: chi apre il link mezz'ora prima e
    //   torna a fare altro non ha bisogno di essere aggiornato ogni due secondi
    //   e mezzo per mezz'ora.
    return o.visibile ? RITMO.attesa : RITMO.ondaDietro;
  }
  return RITMO.fermo;
}
