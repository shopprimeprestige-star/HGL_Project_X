/** ── RIPESCA: LE SCHEDE FERME CHE NESSUNO RIAPRE PIÙ ───────────────────────
 *
 *  ── IL NUMERO CHE HA FATTO NASCERE QUESTO FILE ───────────────────────────
 *  Misurato in archivio il 7/10/2026: su 1.081 schede, **823 — il 76%** —
 *  stanno in `annullato`, `no_show` o `da_ricontattare`. Nella coda delle
 *  telefonate ce n'erano **diciassette**. Cioè il lavoro vero non era in coda:
 *  era in un magazzino che nessuna schermata apriva.
 *
 *  E il programma sapeva già scrivere a quelle persone: `messaggioRifissa`
 *  compone tre messaggi diversi a seconda che la consulenza si sia fatta,
 *  saltata o mai fissata. Solo che era raggiungibile **soltanto** dai contatti
 *  di ritorno — quarantaquattro su mille. L'unico modo per far riemergere un
 *  «non si è presentato» di tre mesi fa era ricaricare un file che lo
 *  contenesse: cioè aspettare che il caso lo riportasse a galla.
 *
 *  Qui si risponde a una domanda sola: «chi è fermo da abbastanza tempo da
 *  valere una riga su WhatsApp?».
 *
 *  ⚠️ NON SI SPOSTA E NON SI SCRIVE NIENTE DA SOLI. Questo modulo SCEGLIE, non
 *   decide: niente stati che cambiano per conto loro, niente messaggi
 *   automatici. È la stessa regola dei contatti di ritorno — «niente si muove
 *   alle mie spalle» — e vale ancora di più qui, dove si parla a gente che
 *   aveva detto no.
 *  ⚠️ IL SILENZIO SI MISURA SU `updated_at`, non sulla data dell'ultimo
 *   appuntamento: quello che conta è da quanto NESSUNO tocca quella scheda. Una
 *   consulenza saltata a giugno su cui si è lavorato ieri non è dimenticata; una
 *   del mese scorso che nessuno apre da allora sì.
 *  ⚠️ CHI HA COMPRATO NON SI RIPESCA, e chi è in trattativa nemmeno: non sono
 *   schede ferme, sono schede in corso. Riscrivere «riprendiamo da dove
 *   eravamo» a chi ha un acconto versato è il modo di sembrare un call center.
 *  ⚠️ E NEMMENO CHI È IN CODA: quello si telefona, non si ripesca. Se è in uno
 *   stato di prima chiamata la sua strada esiste già ed è migliore.
 *  ───────────────────────────────────────────────────────────────────────── */
import type { Lead, LeadData, LeadStatus } from "@/crm/types";
import { eChiusuraVinta, eStatoDaChiamare } from "@/crm/types";

/** ── GLI STATI CHE VALE LA PENA RIPRENDERE ─────────────────────────────────
 *  Sono quelli in cui la porta non è chiusa: la persona c'è, ci ha parlato, e
 *  quello che manca è un motivo per riaprire il discorso.
 *
 *  ⚠️ `non_interessato` NON C'È, ed è una scelta: è l'unico stato in cui la
 *   persona ha detto di no a noi, non alle circostanze. Riscrivergli vuol dire
 *   farsi bloccare il numero, e un numero bloccato non si recupera più.
 *  ⚠️ L'ordine è quello della resa: in cima chi era quasi arrivato. */
export const STATI_DORMIENTI: LeadStatus[] = [
  "no_show",
  "da_spostare",
  "fissa_meet_dopo",
  "sta_valutando",
  "da_ricontattare",
  "gestire_in_chat",
  "annullato",
  "perdi_tempo",
];

/** Di serie si guarda chi tace da un mese: sotto, è ancora lavoro di qualcuno. */
export const SILENZIO_PREDEFINITO_GG = 30;
const GIORNO_MS = 24 * 60 * 60 * 1000;

/** Da quanti giorni nessuno tocca questa scheda. `-1` = non si sa (e «non si
 *  sa» non vale come «da sempre»: una data illeggibile non deve far comparire
 *  una persona in cima a un elenco di dimenticati). */
export function giorniDiSilenzio(
  l?: { updated_at?: string | null; created_at?: string | null } | null,
  oggi: Date = new Date(),
): number {
  const t = Date.parse(String(l?.updated_at || l?.created_at || ""));
  if (!Number.isFinite(t)) return -1;
  return Math.max(0, Math.floor((oggi.getTime() - t) / GIORNO_MS));
}

/** Questa scheda è ferma e si può riprendere? */
export function eDormiente(
  l?: Lead | null,
  p?: { stati?: LeadStatus[]; giorniMin?: number },
  oggi: Date = new Date(),
): boolean {
  const d: Partial<LeadData> = l?.data ?? {};
  const stato = String(d.stato ?? "") as LeadStatus;
  if (!stato) return false;
  //  Chi ha comprato e chi si telefona oggi hanno già la loro strada.
  if (eChiusuraVinta(stato) || eStatoDaChiamare(stato)) return false;
  const ammessi = p?.stati?.length ? p.stati : STATI_DORMIENTI;
  if (!ammessi.includes(stato)) return false;
  const giorni = giorniDiSilenzio(l, oggi);
  if (giorni < 0) return false;
  return giorni >= (p?.giorniMin ?? SILENZIO_PREDEFINITO_GG);
}

/** Le schede ferme, dalla più dimenticata.
 *  ⚠️ L'ORDINE È IL SILENZIO, non la data dell'appuntamento: in cima va chi
 *   nessuno guarda da più tempo, perché è quella la riga che non tornerà mai a
 *   galla da sola. */
export function dormienti(
  leads?: Lead[] | null,
  p?: { stati?: LeadStatus[]; giorniMin?: number },
  oggi: Date = new Date(),
): Lead[] {
  return (leads ?? [])
    .filter((l) => eDormiente(l, p, oggi))
    .sort((a, b) => giorniDiSilenzio(b, oggi) - giorniDiSilenzio(a, oggi));
}

/** Quanti ce n'è per ogni stato, sul silenzio scelto: sono i numeri scritti
 *  sui filtri, e si contano con l'altro filtro già applicato — se no un filtro
 *  mostra il conteggio di sé stesso e dice sempre «tutti». */
export function contiPerStato(
  leads?: Lead[] | null,
  giorniMin: number = SILENZIO_PREDEFINITO_GG,
  oggi: Date = new Date(),
): Map<LeadStatus, number> {
  const m = new Map<LeadStatus, number>();
  for (const l of dormienti(leads, { giorniMin }, oggi)) {
    const s = l.data?.stato as LeadStatus;
    if (s) m.set(s, (m.get(s) ?? 0) + 1);
  }
  return m;
}

/** Da quanto tace, in parole. Vuoto = non si sa. */
export function etichettaSilenzio(giorni: number): string {
  if (!Number.isFinite(giorni) || giorni < 0) return "";
  if (giorni < 30) return `ferma da ${giorni} giorni`;
  const mesi = Math.floor(giorni / 30);
  if (mesi < 12) return mesi === 1 ? "ferma da un mese" : `ferma da ${mesi} mesi`;
  const anni = Math.floor(mesi / 12);
  return anni === 1 ? "ferma da un anno" : `ferma da ${anni} anni`;
}

/** ── ⚠️ CHI È GIÀ STATO RIPESCATO, E QUANDO ───────────────────────────────
 *  Senza questo segno la stessa persona ricompare in cima all'elenco ogni
 *  volta che si apre la pagina — perché scriverle NON cambia il suo stato (non
 *  deve) — e le si riscrive fra una settimana. Il segno non la toglie
 *  dall'elenco per sempre: la toglie finché il silenzio ricomincia a contare
 *  da capo, che è esattamente ciò che si vuole. */
export function patchRipescato(
  d?: Partial<LeadData> | null,
  chi?: string,
  ora: Date = new Date(),
): Partial<LeadData> {
  const prima = Number(d?.ripescatoVolte);
  return {
    ripescatoIl: ora.toISOString(),
    ...(String(chi || "").trim() ? { ripescatoDa: String(chi).trim() } : {}),
    ripescatoVolte: (Number.isFinite(prima) && prima > 0 ? Math.floor(prima) : 0) + 1,
  };
}

/** Quante volte le abbiamo già riscritto da qui. 0 = mai. */
export function volteRipescato(d?: Partial<LeadData> | null): number {
  const n = Number(d?.ripescatoVolte);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}
