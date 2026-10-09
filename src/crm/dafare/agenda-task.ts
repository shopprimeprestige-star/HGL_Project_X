/** ── UNA COSA DA FARE CHE SI PRENDE UN PEZZO DI GIORNATA ───────────────────
 *
 *  «Occupa l'agenda» non è un'etichetta: se una posa alle 15 non toglie
 *  davvero quell'ora dalla disponibilità, il calendario continua a offrirla ai
 *  clienti — e il doppio appuntamento lo si scopre con due persone davanti.
 *  Qui una riga scritta a mano diventa un BLOCCO vero della disponibilità
 *  (crm/blocchi), cioè la stessa cosa con cui si chiude il centro il lunedì.
 *
 *  ⚠️ IL FILO FRA LE DUE COSE È `bloccoId`, e va tenuto: cancellando la riga
 *   senza togliere il blocco, il calendario resta chiuso per una cosa che non
 *   esiste più — e nessuno saprebbe più perché quel martedì alle 15 non si
 *   può prenotare.
 */
import type { BloccoDisponibilita } from "@/crm/blocchi";

/** Quanto dura di suo una cosa che occupa l'agenda. Un'ora è la misura di
 *  quasi tutto quello che si segna qui dentro — una posa, una riunione, un
 *  giro in banca — ed è meglio di «tutto il giorno», che toglierebbe una
 *  giornata intera a chi voleva togliere un'ora. */
export const DURATA_PREDEFINITA = 60;

/** Le durate offerte nel popup. ⚠️ Poche e tonde: un campo libero in minuti
 *  fa fermare a pensare chi sta scrivendo di corsa, e nove volte su dieci la
 *  risposta è una di queste quattro. */
export const DURATE = [30, 60, 90, 120];

/** "09:30" → 570. Null se non è un orario: un orario che non si legge non è
 *  mezzanotte, è «non lo so», e chi chiama deve poterlo distinguere. */
export function minutiDi(ora?: string | null): number | null {
  const s = String(ora ?? "").trim();
  if (!/^\d{1,2}:\d{2}$/.test(s)) return null;
  const [h, m] = s.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m) || h > 23 || m > 59) return null;
  return h * 60 + m;
}

/** L'ora di fine, tenuta dentro la giornata. ⚠️ Un blocco che finisce alle
 *  25:30 non lo capisce nessuno — né il calcolo degli slot né chi lo legge —
 *  e una posa alle 23:30 che dura due ore finisce a mezzanotte, non domani. */
export function fineOrario(ora: string, durata: number): string {
  const inizio = minutiDi(ora);
  if (inizio === null) return "";
  const fine = Math.min(24 * 60, inizio + Math.max(1, Math.round(durata)));
  return `${String(Math.floor(fine / 60) % 24).padStart(2, "0")}:${String(fine % 60).padStart(2, "0")}`;
}

export interface CosaDaBloccare {
  id: string;
  testo: string;
  data: string;
  ora?: string;
  durata?: number;
  occupaAgenda?: boolean;
  /** Di chi è l'agenda da chiudere. ⚠️ Vuoto = TUTTI, ed è il comportamento di
   *  `crm/blocchi`: una cosa da fare non assegnata a nessuno non deve chiudere
   *  l'agenda di tutto il centro, quindi in quel caso non si scrive nessun
   *  blocco. Vedi il controllo qui sotto. */
  aId?: string;
}

/** Il blocco da scrivere per questa riga, o niente quando non c'è niente da
 *  bloccare. Niente succede quando: non occupa l'agenda, non ha un'ora, o non
 *  si sa di CHI sia — e in tutti e tre i casi scrivere un blocco farebbe più
 *  danno che non scriverlo. */
export function bloccoDaTask(t: CosaDaBloccare): BloccoDisponibilita | null {
  if (!t.occupaAgenda) return null;
  const ora = String(t.ora ?? "").trim();
  if (minutiDi(ora) === null) return null;
  if (!String(t.aId ?? "").trim()) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(t.data ?? ""))) return null;
  const durata = t.durata && t.durata > 0 ? t.durata : DURATA_PREDEFINITA;
  const fine = fineOrario(ora, durata);
  if (!fine || fine <= ora) return null;
  return {
    id: `task-${t.id}`,
    consulenteId: t.aId,
    quando: "data",
    data: t.data,
    inizio: ora,
    fine,
    //  Il motivo si legge nel pannello delle chiusure, dove qualcuno si
    //  chiederà perché quel martedì manca un'ora: dire che viene da una cosa
    //  da fare è l'unica frase che gli permette di ritrovarla.
    motivo: `Da fare: ${t.testo}`.slice(0, 200),
    attivo: true,
    creato: new Date().toISOString(),
  };
}
