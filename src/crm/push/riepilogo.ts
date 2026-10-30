/** ── IL RIEPILOGO DELLA SERA (30/10/2026) ───────────────────────────────────
 *
 *  Ogni sera alle 20:00 di Roma, sugli stessi telefoni delle notifiche
 *  WhatsApp, una riga di SOLI NUMERI:
 *    «Domani 3 consulenze · 2 confermate · 1 da sentire · 4 chat senza risposta»
 *  Niente nomi: la notifica si legge a schermo bloccato (vedi `avviso.ts`).
 *
 *  ⚠️ L'ORA È QUELLA DI ROMA. pg_cron gira in UTC e le 20:00 di Roma sono le
 *   19:00 UTC d'inverno e le 18:00 UTC d'estate: il cron suona a tutte e due
 *   le ore e QUI si decide (`eOraDelRiepilogo`), una volta sola al giorno
 *   (`giroRiepilogo`, con il segno in app_config).
 *  ⚠️ «DOMANI» SI CALCOLA SUL GIORNO DI ROMA, non aggiungendo 24 ore: nella
 *   notte del cambio d'ora il giorno dura 23 o 25 ore.
 *  ⚠️ «DA SENTIRE» = consulenze di domani NON confermate (`statoConferma`):
 *   anche quelle senza messaggio partito, perché a quelle nessuno ha chiesto
 *   niente. Quindi confermate + da sentire = consulenze.
 *  ⚠️ «CHAT SENZA RISPOSTA»: l'ultimo messaggio è del cliente
 *   (`ultimo_in_entrata_il` dopo `risposto_il`) ed è di meno di 24 ore fa.
 *   NON è «Da rispondere» della chat, che non ha limite di età: qui contano
 *   solo quelle a cui si può ancora rispondere gratis, quindi il numero può
 *   essere più basso.
 *  ⚠️ Toccando la notifica si apre /CRM/whatsapp: è lì che si risponde e si
 *   scrive a chi non ha confermato. «Da fare oggi» alle 20 racconta la
 *   giornata che finisce, non quella di domani.
 *  ───────────────────────────────────────────────────────────────────────── */
import { eAppuntamento, type LeadData } from "../types";
import { statoConferma } from "../promemoria/conferma";
import { aRoma } from "../promemoria/formati";
import type { AvvisoPush } from "./avviso";

/** Il riepilogo parte fra le 20:00 (compresa) e le 21:00 (esclusa) di Roma. */
const ORA_RIEPILOGO_MIN = 20 * 60;
const ORA_FINE_MIN = 21 * 60;
const GIORNO_MS = 24 * 3600_000;

/** Il segno «oggi l'ho già mandato» in app_config. */
export const CHIAVE_ULTIMO = "riepilogo_serale_ultimo";

export interface ConteggioSerale {
  consulenze: number;
  confermate: number;
  daSentire: number;
  chatSenzaRisposta: number;
}

/** A Roma sono fra le 20:00 e le 20:59? */
export function eOraDelRiepilogo(adesso: Date): boolean {
  const { minuti } = aRoma(adesso);
  return minuti >= ORA_RIEPILOGO_MIN && minuti < ORA_FINE_MIN;
}

/** Il giorno dopo, come «AAAA-MM-GG» (calendario puro, senza orologi). */
export function giornoDopo(giorno: string): string {
  const [a, m, d] = giorno.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d + 1)).toISOString().slice(0, 10);
}

/** Il giorno di domani a Roma. */
export function domaniARoma(adesso: Date): string {
  return giornoDopo(aRoma(adesso).giorno);
}

/** Le consulenze di domani, quante confermate e quante da sentire. */
export function contaConsulenze(
  schede: { data: Partial<LeadData> }[],
  adesso: Date,
): Pick<ConteggioSerale, "consulenze" | "confermate" | "daSentire"> {
  const domani = domaniARoma(adesso);
  let consulenze = 0;
  let confermate = 0;
  for (const s of schede) {
    const d = s.data;
    if (!d || !eAppuntamento(d.stato) || d.dataMeeting !== domani) continue;
    consulenze++;
    if (statoConferma(d, adesso).tipo === "confermato") confermate++;
  }
  return { consulenze, confermate, daSentire: consulenze - confermate };
}

export interface RigaContatto {
  ultimo_in_entrata_il?: string | null;
  risposto_il?: string | null;
}

/** Le chat in cui l'ultimo messaggio è del cliente ed è di meno di 24 ore fa. */
export function contaChatSenzaRisposta(righe: RigaContatto[], adesso: Date): number {
  const ora = adesso.getTime();
  let n = 0;
  for (const r of righe) {
    const entrata = r.ultimo_in_entrata_il ? Date.parse(r.ultimo_in_entrata_il) : NaN;
    if (!Number.isFinite(entrata) || ora - entrata > GIORNO_MS) continue;
    const risposto = r.risposto_il ? Date.parse(r.risposto_il) : NaN;
    if (Number.isFinite(risposto) && risposto >= entrata) continue;
    n++;
  }
  return n;
}

/** Da quando contano le chat senza risposta (ISO, per la lettura dal database). */
export const sogliaChat = (adesso: Date) => new Date(adesso.getTime() - GIORNO_MS).toISOString();

/** La frase: solo numeri. Senza consulenze non si elencano confermate e da sentire. */
export function fraseRiepilogo(c: ConteggioSerale): string {
  //  «chat» non cambia al plurale.
  const chat = `${c.chatSenzaRisposta} chat senza risposta`;
  if (c.consulenze === 0) return `Domani nessuna consulenza · ${chat}`;
  const cons = c.consulenze === 1 ? "1 consulenza" : `${c.consulenze} consulenze`;
  const conf = c.confermate === 1 ? "1 confermata" : `${c.confermate} confermate`;
  return `Domani ${cons} · ${conf} · ${c.daSentire} da sentire · ${chat}`;
}

/** L'avviso da spedire; `null` se non c'è niente (0 consulenze e 0 chat). */
export function avvisoRiepilogo(c: ConteggioSerale): AvvisoPush | null {
  if (c.consulenze === 0 && c.chatSenzaRisposta === 0) return null;
  return {
    titolo: "Riepilogo della sera",
    corpo: fraseRiepilogo(c),
    chiave: "riepilogo-serale",
    destinazione: "/CRM/whatsapp",
  };
}

/** Le porte del giro: il database e l'invio, passati da fuori (nella rotta
 *  sono quelle vere, nelle prove sono finte). */
export interface PorteRiepilogo {
  /** il giorno dell'ultimo riepilogo mandato, «AAAA-MM-GG», `null` se mai */
  leggiUltimo(): Promise<string | null>;
  /** Prende il giorno in modo ATOMICO: `true` solo per chi lo segna per primo
   *  (due chiamate insieme non mandano due notifiche). */
  scriviUltimo(giorno: string): Promise<boolean>;
  /** le installazioni con almeno un telefono iscritto */
  utenti(): Promise<string[]>;
  /** le schede dell'utente con la consulenza nel giorno dato */
  schede(userId: string, giorno: string): Promise<{ data: Partial<LeadData> }[]>;
  /** i contatti dell'utente con un messaggio del cliente dopo `da` */
  contatti(userId: string, da: string): Promise<RigaContatto[]>;
  invia(userId: string, avviso: AvvisoPush): Promise<{ inviate: number }>;
}

export type EsitoGiro =
  | { fatto: false; motivo: "fuori_orario" | "gia_mandato" | "nessun_telefono" }
  | { fatto: true; installazioni: number; avvisi: number; inviate: number };

/** Il giro della sera. Fuori dalle 20:00-20:59 di Roma non fa niente; il segno
 *  del giorno si scrive PRIMA di spedire: un errore dopo non fa mandare due
 *  riepiloghi, un errore prima (lettura) non brucia la serata.
 *  Il segno è ATOMICO (`scriviUltimo`, 30/10): due giri nello stesso istante
 *  ne fanno partire uno solo. */
export async function giroRiepilogo(porte: PorteRiepilogo, adesso: Date): Promise<EsitoGiro> {
  if (!eOraDelRiepilogo(adesso)) return { fatto: false, motivo: "fuori_orario" };
  const oggi = aRoma(adesso).giorno;
  if ((await porte.leggiUltimo()) === oggi) return { fatto: false, motivo: "gia_mandato" };
  const utenti = await porte.utenti();
  if (utenti.length === 0) return { fatto: false, motivo: "nessun_telefono" };

  const domani = domaniARoma(adesso);
  const daMandare: { userId: string; avviso: AvvisoPush }[] = [];
  for (const userId of utenti) {
    const schede = await porte.schede(userId, domani);
    const contatti = await porte.contatti(userId, sogliaChat(adesso));
    const avviso = avvisoRiepilogo({
      ...contaConsulenze(schede, adesso),
      chatSenzaRisposta: contaChatSenzaRisposta(contatti, adesso),
    });
    if (avviso) daMandare.push({ userId, avviso });
  }
  //  Il segno PRIMA degli invii e atomico: chi arriva secondo si ferma qui.
  if (!(await porte.scriviUltimo(oggi))) return { fatto: false, motivo: "gia_mandato" };
  let inviate = 0;
  for (const { userId, avviso } of daMandare)
    inviate += (await porte.invia(userId, avviso)).inviate;
  return { fatto: true, installazioni: utenti.length, avvisi: daMandare.length, inviate };
}
