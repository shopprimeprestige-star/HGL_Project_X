/** ── PRENOTA IN CHAT: LA SCHEDA (stub del compito 0) ───────────────────────
 *  Lo riempie il compito T4 (PIANO.md). Firme definitive: funzioni pure su
 *  `LeadData`, niente database. */
import type { LeadData } from "../types";
import type { CambioContatto } from "./contatto";
import type { DatiPrenotazione, EsitoPrenotabile, MotivoContatto } from "./prenota-tipi";

/** Lista chiusa di stati (fail-closed): stato sconosciuto = no. */
export function puoPrenotare(_d: LeadData, _adesso: Date): EsitoPrenotabile {
  throw new Error("da fare");
}
/** La scheda tiene lo slot e `dataMeeting`+`oraMeeting` è dopo adesso (Roma). */
export function appuntamentoFuturo(_d: LeadData, _adesso: Date): boolean {
  throw new Error("da fare");
}
/** `prenotatoChat` presente e `g`/`o` uguali a `dataMeeting`/`oraMeeting`. */
export function presaDallaChat(_d: LeadData): boolean {
  throw new Error("da fare");
}
/** Quello che farebbe `updateLead` del browser per questo salvataggio. */
export function daPrenotare(_prima: LeadData, _p: DatiPrenotazione): LeadData {
  throw new Error("da fare");
}
/** Rimette dal `prima` solo ciò che `daPrenotare` ha toccato, e solo se
 *  l'`attuale` combacia per valore con lo `scritto`; altrimenti `null`. */
export function daDisfare(
  _attuale: LeadData,
  _scritto: LeadData,
  _prima: LeadData,
): LeadData | null {
  throw new Error("da fare");
}
/** Aggiunge una riga in fondo alle note, separata da a-capo. */
export function conNota(_note: string | undefined, _riga: string): string {
  throw new Error("da fare");
}
export function cambioRicontatto(_motivo: MotivoContatto, _adesso: Date): CambioContatto {
  throw new Error("da fare");
}
