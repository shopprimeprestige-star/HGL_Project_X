/** ── IL PROSSIMO MEET DELLA GIORNATA, IN CIMA ALL'ELENCO DELLE CHAT ─────────
 *  Richiesta del titolare (30/10/2026): la chat del primo meet che c'è da fare oggi (es. alle 15)
 *  sta sempre in cima, col nome di chi lo farà. Funzione pura: le chat, il giorno, l'ora e i
 *  consulenti entrano, esce UNA chat (o niente) con la sua etichetta «Meet alle 15:00 · Mirko».
 *
 *  LE REGOLE, una per una:
 *  - «Meet da fare» = stato appuntamento fissato o rifissato (`eAppuntamento`, lo stesso elenco
 *    del resto del CRM) con `dataMeeting` di OGGI e un'ora leggibile. «Da riprogrammare», «Fatto»,
 *    «Assente»… hanno una data ma non sono un meet da fare: appena lo stato cambia, la chat esce
 *    da sola e passa il successivo.
 *  - Uno solo: l'ora più vicina; a pari ora, il primo dell'elenco (ordine stabile).
 *  - Se l'ora è passata ma lo stato non è cambiato, resta lui per `ORE_DI_TOLLERANZA` ore: il
 *    titolare deve chiuderlo, non perderlo di vista. Oltre, passa al successivo (e se non c'è, in
 *    cima non resta niente: un meet di ieri mattina non è «il prossimo»).
 *  - Il nome è la prima parola di `consultants[].data.nome`; senza consulente, o con uno
 *    cancellato o senza nome, l'etichetta è solo «Meet alle 15:00».
 *  Provato in prove/idee/prossimo-meet.mjs. */
import { eAppuntamento } from "../types";
import { minutiAlla, oraNormale } from "../promemoria/formati";

/** Quanto può essere passata l'ora di un meet non chiuso prima che in cima passi il successivo. */
export const ORE_DI_TOLLERANZA = 2;

/** Quel che serve di una chat (così vale per `ChatItem` e per le chat finte delle prove). */
interface ChatConMeet {
  lead?: {
    data?: {
      stato?: string | null;
      dataMeeting?: string | null;
      oraMeeting?: string | null;
      consulenteId?: string | null;
    } | null;
  } | null;
}

export interface ProssimoMeet<T> {
  chat: T;
  /** «15:00», sempre con due cifre. */
  ora: string;
  /** Solo il nome del consulente, o `null`. */
  consulente: string | null;
  /** «Meet alle 15:00 · Mirko» (senza consulente: «Meet alle 15:00»). */
  etichetta: string;
}

/** Il meet da fare di una chat: la sua ora, o `null` se non è un meet di oggi ancora da fare. */
function oraDelMeet(c: ChatConMeet, oggi: string, adesso: number): string | null {
  const d = c.lead?.data;
  if (!d || !eAppuntamento(d.stato)) return null;
  if (String(d.dataMeeting ?? "").slice(0, 10) !== oggi) return null;
  const ora = oraNormale(d.oraMeeting);
  if (!ora) return null;
  return minutiAlla(oggi, ora, new Date(adesso)) >= -ORE_DI_TOLLERANZA * 60 ? ora : null;
}

/** Il prossimo meet fra `chats`, o `null`. `oggi` è `oggiIso(...)`, `adesso` in millisecondi.
 *  Non muta l'elenco. */
export function prossimoMeet<T extends ChatConMeet>(
  chats: T[],
  oggi: string,
  adesso: number,
  consulenti: { id: string; data?: { nome?: unknown } | null }[] = [],
): ProssimoMeet<T> | null {
  let migliore: { chat: T; ora: string } | null = null;
  for (const chat of chats) {
    const ora = oraDelMeet(chat, oggi, adesso);
    //  `<` stretto: a pari ora resta il primo trovato.
    if (ora && (!migliore || ora < migliore.ora)) migliore = { chat, ora };
  }
  if (!migliore) return null;
  const id = migliore.chat.lead?.data?.consulenteId;
  const nome = String(consulenti.find((x) => x.id === id)?.data?.nome ?? "")
    .trim()
    .split(/\s+/)[0];
  const consulente = id && nome ? nome : null;
  return {
    chat: migliore.chat,
    ora: migliore.ora,
    consulente,
    etichetta: `Meet alle ${migliore.ora}${consulente ? ` · ${consulente}` : ""}`,
  };
}
