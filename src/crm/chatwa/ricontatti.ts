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
import { LEAD_STATUS_LABEL, type LeadStatus } from "@/crm/types";

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
      esitoRicontatto?: string | null;
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

/** ── STATO + ESITO + DATA, FILTRI CHE SI COMBINANO (31/10/2026) ─────────────────────────────────
 *  Richiesta del titolare: «Attesa acconto + non ha risposto»; sapere che un lead era in Attesa acconto
 *  e poi ha detto «sentiamoci più avanti»; con data icona calendario, senza data icona X.
 *  Dentro «Ricontatti» (e solo lì) tre righe di pastiglie: Stato, Esito, Data. Passa chi le rispetta
 *  TUTTE (E); ogni riga ne ha una sola accesa. Il resto dei filtri della chat resta uno alla volta.
 *  · L'ESITO sta sulla scheda (`esitoRicontatto` + `esitoRicontattoIl`, JSON libero: nessuna migrazione)
 *    e RESTA quando lo stato cambia.
 *  · «CON DATA» = `dataRicontatto` è un giorno vero: la stessa regola dell'ordinamento qui sopra.
 *  Puro, provato in prove/idee/risentire.mjs. */

/** Gli esiti, nell'ordine in cui si propongono. `nome` è corto (sta in una pastiglia a 375 px). */
export const ESITI_RICONTATTO = [
  { v: "non_ha_risposto", nome: "Non ha risposto", titolo: "Non ha risposto" },
  { v: "piu_avanti", nome: "Sentiamoci più avanti", titolo: "Ha detto «sentiamoci più avanti»" },
  { v: "ci_sta_pensando", nome: "Ci sta pensando", titolo: "Ci sta pensando" },
  { v: "aspetta_i_soldi", nome: "Aspetta i soldi", titolo: "Aspetta lo stipendio o i soldi" },
] as const;

export type EsitoRicontatto = (typeof ESITI_RICONTATTO)[number]["v"];

/** Valore del filtro «Senza esito». */
export const ESITO_NESSUNO = "nessuno";

/** L'esito messo sulla scheda, o `null` (assente o non riconosciuto). */
export function esitoDi(c: ChatRicontatto): EsitoRicontatto | null {
  const v = String(c.lead?.data?.esitoRicontatto ?? "");
  return ESITI_RICONTATTO.find((e) => e.v === v)?.v ?? null;
}

/** Cosa scrivere sulla scheda per mettere (o, con `null`, togliere) l'esito: l'unico punto che lo
 *  decide, lo usa `PastigliaEsito` ovunque (riga, chat aperta, scheda). `undefined` sparisce alla
 *  serializzazione: è così che si toglie la chiave da `lead.data`. */
export function patchEsito(nuovo: EsitoRicontatto | null, adesso: Date = new Date()) {
  return nuovo
    ? { esitoRicontatto: nuovo, esitoRicontattoIl: adesso.toISOString() }
    : { esitoRicontatto: undefined, esitoRicontattoIl: undefined };
}

/** Il giorno del ricontatto «AAAA-MM-GG», o `""` se manca o non è un giorno vero. */
export function dataDi(c: ChatRicontatto): string {
  const giorno = String(c.lead?.data?.dataRicontatto ?? "").slice(0, 10);
  return giornoParlato(giorno) ? giorno : "";
}

/** I dati della scheda letti come «richiamo» per disegnare la data sulla riga: `etichettaRichiamo`
 *  guarda solo gli stati che nel CRM chiedono la data, mentre in «Ricontatti» ci sono anche
 *  «Da contattare» e «Da riprogrammare», e la data di un ricontatto è sempre `dataRicontatto`. */
export const datiPerData = (d?: NonNullable<NonNullable<ChatRicontatto["lead"]>["data"]>) => ({
  stato: "richiamo",
  dataRicontatto: d?.dataRicontatto,
  oraRicontatto: d?.oraRicontatto,
});

export interface FiltroRisentire {
  /** `""` = tutti, oppure uno stato di `STATI_RICONTATTI` */
  stato: string;
  /** `""` = tutti, un esito, oppure `ESITO_NESSUNO` */
  esito: string;
  data: "" | "con" | "senza";
}

export type CampoRisentire = keyof FiltroRisentire;

export const RISENTIRE_VUOTO: FiltroRisentire = { stato: "", esito: "", data: "" };

/** C'è almeno una riga accesa? */
export const risentireAcceso = (r: FiltroRisentire): boolean =>
  r.stato !== "" || r.esito !== "" || r.data !== "";

/** La chat rispetta le tre righe (E)? Non guarda di chi è: lo fa `eMioRicontatto`. */
export function passaRisentire(c: ChatRicontatto, r: FiltroRisentire): boolean {
  if (r.stato && String(c.lead?.data?.stato ?? "") !== r.stato) return false;
  if (r.esito) {
    const e = esitoDi(c);
    if (r.esito === ESITO_NESSUNO ? e !== null : e !== r.esito) return false;
  }
  if (r.data === "con" && dataDi(c) === "") return false;
  if (r.data === "senza" && dataDi(c) !== "") return false;
  return true;
}

/** Quante chat vedresti toccando la pastiglia `campo = valore` (le altre due righe restano). `chats` sono
 *  già i miei ricontatti. */
export function contaRisentire(
  chats: readonly ChatRicontatto[],
  r: FiltroRisentire,
  campo: CampoRisentire,
  valore: string,
): number {
  const prova = { ...r, [campo]: valore } as FiltroRisentire;
  return chats.filter((c) => passaRisentire(c, prova)).length;
}

/** Tocca una pastiglia: se è accesa si spegne, altrimenti sostituisce quella accesa della sua riga. */
export function commutaRisentire(
  r: FiltroRisentire,
  campo: CampoRisentire,
  valore: string,
): FiltroRisentire {
  return { ...r, [campo]: r[campo] === valore ? "" : valore } as FiltroRisentire;
}

/** Gli stati della prima riga: quelli con almeno un ricontatto, nell'ordine del CRM, più quello scelto
 *  (anche se intanto non ha più chat: un filtro acceso si vede sempre). */
export function statiRisentire(chats: readonly ChatRicontatto[], r: FiltroRisentire): string[] {
  const presenti = new Set(chats.map((c) => String(c.lead?.data?.stato ?? "")));
  return (Object.keys(LEAD_STATUS_LABEL) as LeadStatus[]).filter(
    (s) => STATI_RICONTATTI.has(s) && (presenti.has(s) || s === r.stato),
  );
}
