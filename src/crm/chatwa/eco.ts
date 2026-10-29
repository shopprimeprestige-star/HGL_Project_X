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
 *  ⚠️ COM'È FATTA UN'ECO (tutte e quattro):
 *   1. è una riga ManyChat in entrata (`wa_message_id` «mc-in:…»);
 *   2. il testo è uguale (stessa ripulitura del ponte) all'entrata
 *      PRECEDENTE dello stesso numero;
 *   3. fra le due c'è almeno un nostro messaggio (è quello che fa partire il
 *      Default Reply);
 *   4. nessuna riga del ponte (il WhatsApp vero) è segnata come suo pari: se
 *      il ponte l'ha vista arrivare, il cliente l'ha scritta davvero.
 *  Un «sì» ripetuto davvero dal cliente, col ponte acceso, quindi resta.
 *  ───────────────────────────────────────────────────────────────────────── */
import { normalizzaTesto } from "../ponte/pari";
import { CONFRONTO_CARATTERI } from "../ponte/tipi";
import type { WaMessageRow } from "./tipi";

const chiave = (t: string | null | undefined) => normalizzaTesto(t).slice(0, CONFRONTO_CARATTERI);

/** L'altro capo della chat: chi scrive (entrata) o a chi scriviamo (uscita). */
const peerDi = (m: WaMessageRow) => (m.direction === "inbound" ? m.from_number : m.to_number);

/** Gli id delle righe che sono eco. `righe` dal più vecchio al più nuovo. Pura. */
export function idEco(righe: WaMessageRow[]): Set<string> {
  //  Le righe ManyChat che il ponte ha visto arrivare (qualcuno ha `duplicato_di` = loro).
  const confermate = new Set(
    righe.filter((r) => r.duplicato_di).map((r) => String(r.duplicato_di)),
  );
  const fuori = new Set<string>();
  //  Per numero: l'ultima entrata vista (testo) e se dopo c'è stata una nostra uscita.
  const stato = new Map<string, { testo: string; uscitaDopo: boolean }>();
  for (const r of righe) {
    if (r.duplicato_di) continue; // i doppioni del ponte sono già nascosti
    const peer = peerDi(r);
    if (r.direction === "outbound") {
      const s = stato.get(peer);
      if (s) s.uscitaDopo = true;
      continue;
    }
    const testo = chiave(r.body);
    const prima = stato.get(peer);
    const eco =
      !!testo &&
      String(r.wa_message_id ?? "").startsWith("mc-in:") &&
      !!prima &&
      prima.uscitaDopo &&
      prima.testo === testo &&
      !confermate.has(r.id);
    if (eco) {
      fuori.add(r.id);
      //  L'eco non conta come entrata: l'ultima resta quella vera, e la nostra
      //  uscita resta «dopo» (un'altra eco dello stesso testo è ancora eco).
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
