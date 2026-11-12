/** ── LE DESCRIZIONI PRONTE ─────────────────────────────────────────────────
 *  ⚠️ Stanno in un file loro (non più dentro FinestraFattura.tsx) perché le usa
 *   anche il caricamento bulk, che è codice puro e non può importare una
 *   finestra: una sola lista per tutti, spostata qui com'era, senza ritocchi.
 *
 *  La prima è la predefinita: «Fornitura impianto capillare», scelta dal
 *  committente — è come il centro chiama il suo prodotto. Nomina il bene, che è
 *  quello che un commercialista si aspetta di leggere: una descrizione generica
 *  («Prestazione», «Servizio») su una fattura da migliaia di euro è la prima
 *  riga su cui si ferma un controllo.
 *
 *  ⚠️ NON C'È QUELLA DEL TRAPIANTO, e non è una dimenticanza: il trapianto è
 *   un'altra operazione — una prestazione eseguita da una clinica terza — e ha
 *   un trattamento fiscale suo, che non è quello della fornitura di una
 *   protesi. Prepararne una qui vorrebbe dire suggerire una riga che si decide
 *   col commercialista, non che si sceglie da una tendina.
 *  ⚠️ E L'ALIQUOTA VA CON LA DESCRIZIONE: una protesi può ricadere in casi ad
 *   aliquota ridotta. Qui non si tocca niente — l'aliquota sta nelle
 *   impostazioni — ma è il motivo per cui questa riga non si sceglie a caso. */
export const DESCRIZIONI = [
  //  ⚠️ «Fornitura impianto capillare», scelta del committente: è come il
  //   centro chiama il suo prodotto, ed è la formula che comparirà su tutte le
  //   fatture. Le altre restano per i casi in cui l'operazione è un'altra.
  "Fornitura impianto capillare",
  "Fornitura e applicazione di impianto capillare",
  "Manutenzione e rigenerazione di impianto capillare",
  //  ⚠️ QUESTA NON È UN SINONIMO DELLE ALTRE, ed è l'unica scelta di questo
  //   elenco che cambia COSA si sta fatturando. Va usata se i cento euro sono
  //   il compenso della consulenza — un servizio che si è già reso, e che
  //   resta dovuto anche se il cliente poi non compra. Se invece sono un
  //   anticipo sull'impianto, l'operazione è la fornitura e la descrizione
  //   giusta è la prima: dirla «consulenza» scriverebbe sul documento
  //   un'operazione diversa da quella avvenuta, e al saldo i conti non
  //   tornerebbero (l'acconto non si scomputerebbe da niente).
  "Prestazione di consulenza",
];
