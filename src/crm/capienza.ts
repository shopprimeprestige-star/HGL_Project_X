/** ─────────────────────────────────────────────────────────────────────────
 *  QUANTE PERSONE STANNO NELLA STESSA FASCIA — E DOVE SI CAMBIA IL NUMERO
 *
 *  Richiesta del committente: prima «fino a 3 persone nella stessa ora di
 *  consulenza per singolo consulente», poi «fai che posso cambiare il numero
 *  dalle impostazioni».
 *
 *  DOV'È IL NUMERO
 *  In `app_config`, chiave `crm_capienza_fascia`, come JSON. È la stessa casa
 *  delle altre configurazioni trasversali del CRM (i blocchi della
 *  disponibilità), e non richiede una migrazione.
 *
 *  PERCHÉ IL CALCOLO NON LEGGE IL DATABASE
 *  Gli orari liberi si calcolano in modo SINCRONO, dentro un render, quaranta
 *  giorni per volta: una lettura per riga di calendario non è un'opzione. Il
 *  numero vive quindi in un registro in memoria dentro crm/booking-utils (che
 *  resta un file puro, senza database e senza rete) e qui c'è l'unica porta
 *  che lo riempie.
 *  ⚠️ Finché nessuno chiama `assicuraCapienza()` vale il predefinito — tre —
 *   che è il comportamento di sempre. Il posto da cui chiamarla è l'avvio del
 *   CRM (vedi CRMContext).
 *  ─────────────────────────────────────────────────────────────────────────
 */
import { dbConfig } from "./blocchi";
//  ⚠️ La chiave della riga e la lettura del suo contenuto stanno in
//   booking-utils, che è puro: le legge anche il server della disponibilità, e
//   due letture diverse dello stesso numero sono due agende diverse.
import {
  CAPIENZA_PREDEFINITA,
  CHIAVE_CAPIENZA,
  capienzaConsulenza,
  impostaCapienza,
  leggiCapienzaDaJson,
} from "./booking-utils";

export { CHIAVE_CAPIENZA };

let attesa: Promise<number> | null = null;

export async function caricaCapienza(): Promise<number> {
  const { data } = await dbConfig
    .from("app_config")
    .select("value")
    .eq("key", CHIAVE_CAPIENZA)
    .maybeSingle();
  return impostaCapienza(leggiCapienzaDaJson(data?.value));
}

/** Il numero, letto una volta sola per sessione. */
export function assicuraCapienza(): Promise<number> {
  if (!attesa) {
    attesa = caricaCapienza().catch(() => {
      //  Una lettura fallita non resta in cache per sempre: al prossimo giro
      //  si riprova, e intanto vale il predefinito.
      attesa = null;
      return capienzaConsulenza();
    });
  }
  return attesa;
}

export async function salvaCapienza(n: number): Promise<{ ok: boolean; errore?: string; valore: number }> {
  //  Si scrive il numero RIPULITO, non quello digitato: se il campo dicesse
  //  zero e il database lo accettasse, l'agenda si chiuderebbe per tutti.
  const valore = impostaCapienza(n);
  const { error } = await dbConfig.from("app_config").upsert(
    {
      key: CHIAVE_CAPIENZA,
      value: JSON.stringify({ v: 1, capienza: valore }),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );
  if (error) {
    //  Scrittura fallita: il registro NON si tiene il numero nuovo, o a schermo
    //  si vedrebbe una capienza che il database non conosce.
    await caricaCapienza().catch(() => CAPIENZA_PREDEFINITA);
    return { ok: false, errore: error.message, valore: capienzaConsulenza() };
  }
  attesa = Promise.resolve(valore);
  return { ok: true, valore };
}
