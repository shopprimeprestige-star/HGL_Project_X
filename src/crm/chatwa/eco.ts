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
 *
 *  ── L'ECO SENZA CONTENUTO (31/10/2026, «Reazione, sticker o posizione») ────
 *  Segnalazione del titolare: dopo ogni messaggio scritto dal telefono compare, 1-3 secondi
 *  dopo, una bolla del cliente «Reazione, sticker o posizione: aprila in ManyChat». Il cliente
 *  non ha scritto: è la stessa eco del Default Reply, ma arrivata SENZA testo (`{{...}}` o
 *  vuoto). Il server controllava l'eco solo per i testi (`ecoDi`), quindi questa passava e
 *  veniva registrata come «[messaggio senza testo]» in entrata.
 *  Regola (server in manychat/risposta, qui per le righe già scritte): una entrata ManyChat
 *  SENZA contenuto riconoscibile arrivata fra `ECO_VUOTA_PRIMA_MS` prima e `ECO_VUOTA_DOPO_MS`
 *  dopo un nostro messaggio dello stesso numero (da qualunque canale, non fallito) è un'eco.
 *  A schermo sparisce, nel database resta (nessuna cancellazione). Nessun limite di data: dopo
 *  la correzione il server non le scrive più, e se il ponte scrive il nostro messaggio dopo
 *  l'eco (lo scrive con l'ora del telefono, ma può arrivare tardi) qui la si prende lo stesso.
 *  ⚠️ LIMITE ACCETTATO: una reazione o uno sticker VERI mandati dal cliente entro 30 secondi
 *   da un nostro messaggio non si vedono (ManyChat non ci dà altro per distinguerli: il corpo
 *   è solo `testo`). Non riaprono la finestra e non richiedono risposta.
 *  ───────────────────────────────────────────────────────────────────────── */
import { normalizzaTesto } from "../ponte/pari";
import { CONFRONTO_CARATTERI } from "../ponte/tipi";
import type { WaMessageRow } from "./tipi";
import { classificaTesto } from "./media";

/** Quando è andata online la correzione del server (fix/manychat-eco, 29/10
 *  ore 18:25 a Roma, con qualche minuto di margine per la pubblicazione). */
export const FINO_A = Date.parse("2026-10-29T17:40:00Z");

/** Un'eco senza contenuto arriva entro questo tempo DOPO il nostro messaggio (viste: da 1 a 21 secondi). */
export const ECO_VUOTA_DOPO_MS = 30_000;
/** Tolleranza per l'orologio del telefono, che data i nostri messaggi del ponte: l'eco può sembrare
 *  appena PRIMA di essi. */
export const ECO_VUOTA_PRIMA_MS = 5_000;

/** Il testo di una entrata ManyChat è senza contenuto riconoscibile? Vuoto, «[messaggio senza
 *  testo]» o solo segnaposto `{{...}}`. Media (link) e parole no. */
export function eSenzaContenuto(body: string | null | undefined): boolean {
  const t = String(body ?? "").trim();
  return t === "" || classificaTesto(t).tipo === "illeggibile";
}

/** Un'entrata senza contenuto, arrivata a `quando` (ms), è l'eco di un nostro messaggio? `uscite`:
 *  gli istanti (ms) dei nostri messaggi partiti, dello stesso numero. Pura. */
export function eEcoVuota(quando: number, uscite: readonly number[]): boolean {
  if (!Number.isFinite(quando)) return false;
  return uscite.some((u) => {
    const dopo = quando - u;
    return Number.isFinite(u) && dopo >= -ECO_VUOTA_PRIMA_MS && dopo <= ECO_VUOTA_DOPO_MS;
  });
}

const chiave = (t: string | null | undefined) => normalizzaTesto(t).slice(0, CONFRONTO_CARATTERI);

/** L'altro capo della chat: chi scrive (entrata) o a chi scriviamo (uscita). */
const peerDi = (m: WaMessageRow) => (m.direction === "inbound" ? m.from_number : m.to_number);

/** Gli id delle righe che sono eco. `righe` dal più vecchio al più nuovo. Pura. */
export function idEco(righe: WaMessageRow[]): Set<string> {
  const fuori = new Set<string>();
  //  Per numero: gli istanti dei nostri messaggi partiti (per l'eco senza contenuto).
  const uscite = new Map<string, number[]>();
  for (const r of righe) {
    if (r.direction !== "outbound" || r.duplicato_di || r.eliminato_il || r.status === "failed")
      continue;
    const t = Date.parse(r.created_at);
    const peer = peerDi(r);
    if (Number.isFinite(t)) uscite.set(peer, [...(uscite.get(peer) ?? []), t]);
  }
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
    //  L'eco senza contenuto: si nasconde (qualunque data) e non cambia l'ultimo testo.
    if (
      String(r.wa_message_id ?? "").startsWith("mc-in:") &&
      eSenzaContenuto(r.body) &&
      eEcoVuota(Date.parse(r.created_at), uscite.get(peer) ?? [])
    ) {
      fuori.add(r.id);
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
