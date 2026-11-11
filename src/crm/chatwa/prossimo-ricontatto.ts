/** ── IL PROSSIMO RICONTATTO DI OGGI, IN CIMA ALL'ELENCO DELLE CHAT (11/11/2026) ──
 *  Richiesta del titolare: «quando metto da ricontattare e abbiamo concordato le 15, non esce il
 *  promemoria dentro alle chat di quello che deve chiamare: fai che ne abbia comunque promemoria
 *  sopra». Gemello di prossimo-meet.ts: le chat entrano, esce UNA chat (o niente) con l'etichetta
 *  «Da richiamare alle 15:00 · Mirko».
 *
 *  LE REGOLE, una per una:
 *  - «Ricontatto concordato» = un richiamo come lo legge il resto della chat (`richiamoDi`: gli stati
 *    che chiedono `dataRicontatto`, Ricontatto fissato, Richiamo concordato, Sta valutando…) con la
 *    data di OGGI e un'ora. Senza ora non c'è un momento da ricordare: resta la pastiglia sulla riga.
 *  - Uno solo: l'ora più vicina; a pari ora, il primo dell'elenco (ordine stabile).
 *  - Se l'ora è passata e lo stato non è cambiato, resta lui per `ORE_DI_TOLLERANZA` ore (come il
 *    meet): va chiamato, non perso di vista. Oltre, passa al successivo.
 *  - `soloDi`: l'id del consulente che è dentro, come per il meet. Con lui conta solo il SUO
 *    ricontatto; vuoto (titolare) = di tutti.
 *  - Il nome è la prima parola di `consultants[].data.nome`; senza, solo «Da richiamare alle 15:00».
 *  Provato in prove/idee/prossimo-ricontatto.mjs. */
import { minutiAlla } from "../promemoria/formati";
import { ORE_DI_TOLLERANZA } from "./prossimo-meet";
import { richiamoDi } from "./richiamo";

interface ChatConRicontatto {
  lead?: {
    data?: {
      stato?: string | null;
      dataRicontatto?: string | null;
      oraRicontatto?: string | null;
      consulenteId?: string | null;
    } | null;
  } | null;
}

export interface ProssimoRicontatto<T> {
  chat: T;
  /** «15:00», sempre con due cifre. */
  ora: string;
  /** L'ora è già passata (lo stato non è cambiato): la barra lo dice. */
  passato: boolean;
  /** «Da richiamare alle 15:00 · Mirko» (senza consulente: «Da richiamare alle 15:00»). */
  etichetta: string;
}

export function prossimoRicontatto<T extends ChatConRicontatto>(
  chats: T[],
  oggi: string,
  adesso: number,
  consulenti: { id: string; data?: { nome?: unknown } | null }[] = [],
  soloDi = "",
): ProssimoRicontatto<T> | null {
  let migliore: { chat: T; ora: string; minuti: number } | null = null;
  for (const chat of chats) {
    if (soloDi && chat.lead?.data?.consulenteId !== soloDi) continue;
    const r = richiamoDi(chat.lead?.data);
    if (!r || r.data !== oggi || !r.ora) continue;
    const minuti = minutiAlla(oggi, r.ora, new Date(adesso));
    if (minuti < -ORE_DI_TOLLERANZA * 60) continue;
    //  `<` stretto: a pari ora resta il primo trovato.
    if (!migliore || r.ora < migliore.ora) migliore = { chat, ora: r.ora, minuti };
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
    passato: migliore.minuti < 0,
    etichetta: `Da richiamare alle ${migliore.ora}${consulente ? ` · ${consulente}` : ""}`,
  };
}
