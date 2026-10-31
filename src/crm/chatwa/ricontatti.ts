/** ── «RICONTATTI»: I MIEI LEAD DA RISENTIRE, PER DATA (31/10/2026) ───────────
 *  Richiesta del titolare: una scorciatoia fra «Sconosciuti» e «Clienti» con dentro, tutti insieme,
 *  gli attesa acconto, i da contattare, chi sta valutando… ordinati per data di ricontatto: in alto
 *  i più recenti, scendendo i meno recenti. Ognuno vede solo i SUOI, l'admin compreso.
 *
 *  · CHI ENTRA: ogni stato che nel CRM porta una `dataRicontatto` (le voci di QUANDO_PER_STATO che
 *    scrivono lì: Ricontatto fissato, Sta valutando, Attesa acconto, Lead in chat, Meet da fissare,
 *    Richiamo, Per ora no, Ci ricontatta lui, Visita disdetta), più «Da contattare» e «Da
 *    riprogrammare» (`da_spostare`), che la data la portano ma la scrivono altrove. Elenco derivato,
 *    non un secondo da tenere allineato: un nuovo stato con data entra da solo.
 *  · ORDINE: data DECRESCENTE e, nello stesso giorno, ora decrescente (senza ora in fondo al
 *    giorno). Senza data in fondo a tutto. A parità l'ordine di arrivo resta (sort stabile).
 *  · SOLO I PROPRI: il consulente del lead è quello di chi è dentro (`io`, l'id di chi ha digitato
 *    il PIN: `useConsulenteCollegato`). Nessuna eccezione per l'admin. Senza `io` (titolare entrato
 *    con email e password, senza PIN) non passa nessuno: non si indovina chi sia.
 *  Tutto puro: niente React, niente Supabase. Provato in prove/idee/ricontatti.mjs. */
import { giornoParlato, oraNormale } from "@/crm/promemoria/formati";
import { QUANDO_PER_STATO } from "@/crm/quando-per-stato";

/** Stati che non hanno la data nella tabella del «quando» ma la portano lo stesso. */
const ALTRI_STATI_A_DATA: readonly string[] = ["da_contattare", "da_spostare"];

/** Gli stati di «Ricontatti». */
export const STATI_RICONTATTI: ReadonlySet<string> = new Set([
  ...Object.entries(QUANDO_PER_STATO)
    .filter(([, r]) => r?.chiaveData === "dataRicontatto")
    .map(([stato]) => stato),
  ...ALTRI_STATI_A_DATA,
]);

/** Quello che serve di una chat: la scheda abbinata, se c'è. */
export interface ChatRicontatto {
  lead?: {
    data?: {
      stato?: string | null;
      consulenteId?: string | null;
      dataRicontatto?: string | null;
      oraRicontatto?: string | null;
    } | null;
  } | null;
}

/** La chat è un ricontatto: ha una scheda in uno stato «a data». Non guarda di chi è. */
export const eRicontatto = (c: ChatRicontatto): boolean =>
  STATI_RICONTATTI.has(String(c.lead?.data?.stato ?? ""));

/** È un ricontatto di `io`? Senza `io` mai. */
export const eMioRicontatto = (c: ChatRicontatto, io: string): boolean =>
  io !== "" && eRicontatto(c) && c.lead?.data?.consulenteId === io;

/** «AAAA-MM-GG HH:MM» da ordinare come testo; `""` se la data manca o non è un giorno vero. */
function chiave(c: ChatRicontatto): string {
  const d = c.lead?.data;
  const giorno = String(d?.dataRicontatto ?? "").slice(0, 10);
  if (!giornoParlato(giorno)) return "";
  return `${giorno} ${oraNormale(d?.oraRicontatto) ?? ""}`;
}

/** Dalla data più recente (o futura) alla più vecchia; senza data in fondo. Non muta l'ingresso. */
export function ordinaRicontatti<T extends ChatRicontatto>(chats: readonly T[]): T[] {
  return chats
    .map((c) => ({ c, k: chiave(c) }))
    .sort((a, b) => (a.k === b.k ? 0 : a.k === "" ? 1 : b.k === "" ? -1 : a.k < b.k ? 1 : -1))
    .map((x) => x.c);
}

/** La frase quando l'elenco è vuoto: dice la verità sul perché. */
export function fraseRicontattiVuoti(io: string, cercando: boolean): string {
  if (!io)
    return "Questo accesso non è legato a nessun consulente: entra col tuo PIN per vedere i tuoi ricontatti";
  return cercando ? "Nessun tuo ricontatto in questa ricerca" : "Nessun tuo lead da ricontattare";
}
