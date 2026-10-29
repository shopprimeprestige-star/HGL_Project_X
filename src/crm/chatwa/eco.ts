/** ── LE ECO DI MANYCHAT, NASCOSTE ANCHE NEI MESSAGGI GIÀ SALVATI ───────────
 *
 *  Segnalazione del titolare (29/10/2026), con lo screenshot: «duplica messaggi
 *  come se ha risposto il cliente ma non l'ha fatto».
 *  La causa è la coesistenza: ogni messaggio mandato dall'app WhatsApp
 *  Business fa ripartire il Default Reply di ManyChat con l'ULTIMO testo del
 *  cliente, che arrivava al CRM come una risposta nuova. Dal 29/10 alle 18:25
 *  il server le scarta (`ecoDi` in manychat/risposta, fix/manychat-eco), ma le
 *  righe nate prima sono in archivio: la chat le mostrava come messaggi del
 *  cliente e le rimetteva in «Da rispondere».
 *  Qui si nascondono A SCHERMO, senza cancellare né cambiare niente.
 *
 *  ⚠️ SOLO LE RIGHE DI PRIMA DELLA CORREZIONE (`FINO_A`): dopo, le eco non
 *   arrivano più in archivio e decide il server (`ecoDi`). Così un «sì» che il
 *   cliente ripete davvero oggi non sparisce mai dallo schermo (revisione).
 *  ⚠️ COM'È FATTA UN'ECO (tutte):
 *   1. è una riga ManyChat in entrata («mc-in:…») salvata prima di `FINO_A`;
 *   2. è un TESTO (media, posizioni, «[messaggio senza testo]» no: come il
 *      server, che li salta) uguale — stessa ripulitura del ponte — all'ultimo
 *      TESTO in entrata dello stesso numero;
 *   3. fra i due c'è almeno un nostro messaggio (è quello che fa partire il
 *      Default Reply).
 *  ⚠️ «DA RISPONDERE» LEGGE LE COLONNE DEL CONTATTO, non queste righe: una
 *   chat la cui ultima entrata era un'eco vecchia resta lì finché non si
 *   risponde o si preme «Fatto». Qui si sistemano le bolle.
 *  ───────────────────────────────────────────────────────────────────────── */
import { normalizzaTesto } from "../ponte/pari";
import { CONFRONTO_CARATTERI } from "../ponte/tipi";
import type { WaMessageRow } from "./tipi";
import { classificaTesto } from "./media";

/** Quando è andata online la correzione del server (fix/manychat-eco, 29/10
 *  ore 18:25 a Roma, con qualche minuto di margine per la pubblicazione). */
export const FINO_A = Date.parse("2026-10-29T17:40:00Z");

const chiave = (t: string | null | undefined) => normalizzaTesto(t).slice(0, CONFRONTO_CARATTERI);

/** L'altro capo della chat: chi scrive (entrata) o a chi scriviamo (uscita). */
const peerDi = (m: WaMessageRow) => (m.direction === "inbound" ? m.from_number : m.to_number);

/** Gli id delle righe che sono eco. `righe` dal più vecchio al più nuovo. Pura. */
export function idEco(righe: WaMessageRow[]): Set<string> {
  const fuori = new Set<string>();
  //  Per numero: l'ultimo TESTO in entrata e se dopo c'è stata una nostra uscita.
  const stato = new Map<string, { testo: string; uscitaDopo: boolean }>();
  for (const r of righe) {
    if (r.duplicato_di) continue; // i doppioni del ponte sono già nascosti
    const peer = peerDi(r);
    if (r.direction === "outbound") {
      const s = stato.get(peer);
      if (s) s.uscitaDopo = true;
      continue;
    }
    //  Media e righe senza testo: non sono eco e non cambiano l'ultimo testo.
    if (!r.body || classificaTesto(r.body).tipo !== "testo") continue;
    const testo = chiave(r.body);
    if (!testo) continue;
    const prima = stato.get(peer);
    const eco =
      String(r.wa_message_id ?? "").startsWith("mc-in:") &&
      Date.parse(r.created_at) < FINO_A &&
      !!prima &&
      prima.uscitaDopo &&
      prima.testo === testo;
    if (eco) {
      fuori.add(r.id);
      //  L'eco non conta come entrata: l'ultima resta quella vera.
      continue;
    }
    stato.set(peer, { testo, uscitaDopo: false });
  }
  return fuori;
}

/** Le righe senza le eco. */
export function senzaEco(righe: WaMessageRow[]): WaMessageRow[] {
  const fuori = idEco(righe);
  return fuori.size ? righe.filter((r) => !fuori.has(r.id)) : righe;
}
