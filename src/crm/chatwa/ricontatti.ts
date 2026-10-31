/** ── «RICONTATTI»: I MIEI LEAD DA RISENTIRE, DAL PIÙ GIOVANE (31/10/2026) ────
 *  Richiesta del titolare: una scorciatoia fra «Sconosciuti» e «Clienti» con dentro, tutti insieme,
 *  gli attesa acconto, i da contattare, chi sta valutando… Ognuno vede solo i SUOI, l'admin compreso.
 *
 *  · CHI ENTRA: ogni stato che nel CRM porta una `dataRicontatto` (le voci di QUANDO_PER_STATO che
 *    scrivono lì: Ricontatto fissato, Sta valutando, Attesa acconto, Lead in chat, Meet da fissare,
 *    Richiamo, Per ora no, Ci ricontatta lui, Visita disdetta), più «Da contattare» e «Da
 *    riprogrammare» (`da_spostare`), che la data la portano ma la scrivono altrove. Elenco derivato,
 *    non un secondo da tenere allineato: un nuovo stato con data entra da solo.
 *  · ORDINE (dal 31/10, richiesta del titolare): SEMPRE dal lead arrivato più di recente al più vecchio.
 *    «Arrivo» = `data.createdAt`, la data di acquisizione del lead (la stessa che il CRM mostra e che
 *    conta i «lead di oggi»); se manca, `created_at` della riga. Senza nessuna delle due, in fondo.
 *    La data di RICONTATTO non ordina più: resta sulla riga e nei filtri Data. A parità l'ordine
 *    dell'elenco resta (sort stabile).
 *  · PRIORITÀ: i lead che il titolare fissa con la puntina stanno SOPRA tutti, quanti ne vuole;
 *    fra loro valgono le stesse regole (arrivo più recente per primo), così non saltano quando se ne
 *    aggiunge un altro. Campo suo, `ricontattoPrioritaIl` (ISO): NON è la priorità delle installazioni
 *    (`crm/priorita.ts`, acconti in cima), le due cose non si mescolano. Un lead nascosto non è in
 *    priorità: nascondere toglie il segno (e «Annulla» lo rimette).
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
      esitoRicontatto?: string | null;
      ricontattoNascostoIl?: string | null;
      ricontattoNascostoPer?: string | null;
      ricontattoPrioritaIl?: string | null;
      createdAt?: string | null;
    } | null;
    created_at?: string | null;
  } | null;
}

/** La chat è un ricontatto: ha una scheda in uno stato «a data». Non guarda di chi è. */
export const eRicontatto = (c: ChatRicontatto): boolean =>
  STATI_RICONTATTI.has(String(c.lead?.data?.stato ?? ""));

/** È un ricontatto di `io`? Senza `io` mai. */
export const eMioRicontatto = (c: ChatRicontatto, io: string): boolean =>
  io !== "" && eRicontatto(c) && c.lead?.data?.consulenteId === io;

/** «AAAA-MM-GG HH:MM» da ordinare come testo; `""` se la data manca o non è un giorno vero. */
export function chiave(c: ChatRicontatto): string {
  const d = c.lead?.data;
  const giorno = String(d?.dataRicontatto ?? "").slice(0, 10);
  if (!giornoParlato(giorno)) return "";
  return `${giorno} ${oraNormale(d?.oraRicontatto) ?? ""}`;
}

/** Quando è arrivato il lead, in millisecondi, o `null` se non si sa: `data.createdAt` (data di
 *  acquisizione), poi `created_at` della riga. Un testo che non è una data vale «non si sa». */
export function arrivoMs(c: ChatRicontatto): number | null {
  for (const v of [c.lead?.data?.createdAt, c.lead?.created_at]) {
    const t = Date.parse(String(v ?? ""));
    if (Number.isFinite(t)) return t;
  }
  return null;
}

/** È in priorità? Il segno sulla scheda c'è E il lead non è nascosto (nascosto vince: vedi sotto). */
export const ePrioritario = (c: ChatRicontatto): boolean =>
  !!c.lead?.data?.ricontattoPrioritaIl && !eNascosto(c);

/** In cima chi è in priorità; poi dal lead arrivato più di recente al più vecchio, senza arrivo in
 *  fondo. Non muta l'ingresso. */
export function ordinaRicontatti<T extends ChatRicontatto>(chats: readonly T[]): T[] {
  return chats
    .map((c) => ({ c, p: ePrioritario(c), t: arrivoMs(c) }))
    .sort((a, b) => {
      if (a.p !== b.p) return a.p ? -1 : 1;
      if (a.t === b.t) return 0;
      if (a.t === null) return 1;
      if (b.t === null) return -1;
      return b.t - a.t;
    })
    .map((x) => x.c);
}

/** La frase quando l'elenco è vuoto: dice la verità sul perché. */
export function fraseRicontattiVuoti(io: string, cercando: boolean): string {
  if (!io)
    return "Questo accesso non è legato a nessun consulente: entra col tuo PIN per vedere i tuoi ricontatti";
  return cercando ? "Nessun tuo ricontatto in questa ricerca" : "Nessun tuo lead da ricontattare";
}

/** ── ESITO + DATA, FILTRI CHE SI COMBINANO (31/10/2026) ─────────────────────────────────────────
 *  Richiesta del titolare: sapere che un lead era in Attesa acconto e poi ha detto «sentiamoci più avanti»;
 *  con data icona calendario, senza data icona X. Seconda versione: NIENTE filtro per Stato, solo Esito
 *  (in una barra che si chiude) e Data (un interruttore a segmenti, non sticky). Passa chi rispetta
 *  ENTRAMBI (E); ognuno ha un valore solo. Il resto dei filtri della chat resta uno alla volta.
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
  /** `""` = tutti, un esito, oppure `ESITO_NESSUNO` */
  esito: string;
  data: "" | "con" | "senza";
}

export type CampoRisentire = keyof FiltroRisentire;

export const RISENTIRE_VUOTO: FiltroRisentire = { esito: "", data: "" };

/** C'è almeno un filtro acceso? */
export const risentireAcceso = (r: FiltroRisentire): boolean => r.esito !== "" || r.data !== "";

/** La chat rispetta esito e data (E)? Non guarda di chi è: lo fa `eMioRicontatto`. */
export function passaRisentire(c: ChatRicontatto, r: FiltroRisentire): boolean {
  if (r.esito) {
    const e = esitoDi(c);
    if (r.esito === ESITO_NESSUNO ? e !== null : e !== r.esito) return false;
  }
  if (r.data === "con" && dataDi(c) === "") return false;
  if (r.data === "senza" && dataDi(c) !== "") return false;
  return true;
}

/** Quante chat vedresti toccando la pastiglia `campo = valore` (l'altro filtro resta). `chats` sono
 *  già i miei ricontatti, nascosti esclusi. */
export function contaRisentire(
  chats: readonly ChatRicontatto[],
  r: FiltroRisentire,
  campo: CampoRisentire,
  valore: string,
): number {
  const prova = { ...r, [campo]: valore } as FiltroRisentire;
  return chats.filter((c) => passaRisentire(c, prova)).length;
}

/** Tocca una pastiglia: se è accesa si spegne, altrimenti sostituisce quella accesa del suo filtro. */
export function commutaRisentire(
  r: FiltroRisentire,
  campo: CampoRisentire,
  valore: string,
): FiltroRisentire {
  return { ...r, [campo]: r[campo] === valore ? "" : valore } as FiltroRisentire;
}

/** ── NASCONDERE UN LEAD DA «RICONTATTI» (31/10/2026) ───────────────────────────────────────────
 *  Richiesta del titolare: un'icona sul lead per toglierlo dall'elenco, in un gruppo «Nascosti (N)» in fondo
 *  che si apre e richiude. Vale su tutti i dispositivi: sta sulla scheda (`updateLead`, nessuna migrazione).
 *  · `ricontattoNascostoIl`: l'ISO di quando è stato nascosto. `ricontattoNascostoPer`: la data (e ora) di
 *    ricontatto che aveva ALLORA. Il lead è nascosto finché la data di ricontatto è quella: se la si
 *    cambia (lo si riprogramma) o gliene si mette una, torna da solo nell'elenco, perché è di nuovo vivo.
 *  · NON torna da solo quando scrive il cliente: risponderebbe e sparirebbe di nuovo, a scatti. Chi scrive
 *    si vede in «Da rispondere»; per rimetterlo basta «Mostra».
 *  · Esito e stato non lo toccano: nascosto vuol dire «per ora non lo guardo». */

/** Il lead è nascosto? Sì se c'è il segno E la data di ricontatto è ancora quella di quando l'hai nascosto. */
export function eNascosto(c: ChatRicontatto): boolean {
  const d = c.lead?.data;
  return !!d?.ricontattoNascostoIl && String(d.ricontattoNascostoPer ?? "") === chiave(c);
}

/** Cosa scrivere sulla scheda per nasconderlo: i due campi, e toglie la priorità (un nascosto non sta
 *  in cima). */
export const patchNascondi = (c: ChatRicontatto, adesso: Date = new Date()) => ({
  ricontattoNascostoIl: adesso.toISOString() as string | undefined,
  ricontattoNascostoPer: chiave(c) as string | undefined,
  ricontattoPrioritaIl: undefined as string | undefined,
});

/** Cosa scrivere per rimetterlo: `undefined` sparisce alla serializzazione, la chiave si toglie.
 *  Con `priorita` (l'ISO che aveva prima di essere nascosto, per «Annulla») la rimette anche lei;
 *  senza, non la nomina: non cancella una priorità messa nel frattempo. */
export const patchMostra = (priorita?: string | null) => ({
  ricontattoNascostoIl: undefined as string | undefined,
  ricontattoNascostoPer: undefined as string | undefined,
  ...(priorita ? { ricontattoPrioritaIl: priorita } : {}),
});

/** Separa i nascosti dagli altri, ognuno nel suo ordine. Non muta l'ingresso. */
export function dividiNascosti<T extends ChatRicontatto>(chats: readonly T[]) {
  const visibili: T[] = [];
  const nascosti: T[] = [];
  for (const c of chats) (eNascosto(c) ? nascosti : visibili).push(c);
  return { visibili, nascosti };
}

/** ── PRIORITÀ: METTI / TOGLI (31/10/2026) ───────────────────────────────────────────────────────
 *  La puntina sulla riga. Si salva con `updateLead`, sulla scheda, senza migrazione: vale su tutti i
 *  dispositivi. `metti = false` toglie la chiave (`undefined` sparisce alla serializzazione). */
export const patchPriorita = (metti: boolean, adesso: Date = new Date()) => ({
  ricontattoPrioritaIl: metti ? adesso.toISOString() : (undefined as string | undefined),
});
