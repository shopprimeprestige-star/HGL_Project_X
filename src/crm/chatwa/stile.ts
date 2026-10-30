/** ── LA CHAT WHATSAPP · REGOLE PURE DELLO STILE ────────────────────────────
 *
 *  Commessa 2026-10-28-chat-stile-whatsapp. Funzioni PURE (niente React né
 *  Supabase) usate da BollaMessaggio, Conversazione e Casella: `prove/prove.mjs`
 *  le impacchetta con la voce `chatwa/stile`, prove in `prove/manychat/chat-stile.mjs`.
 *  ───────────────────────────────────────────────────────────────────────── */

/** «0:07», «1:05»: il tempo del lettore dei vocali. Sconosciuto (NaN, ∞, < 0) = «0:00». */
export function tempoVocale(secondi: number): string {
  const s = Number.isFinite(secondi) && secondi > 0 ? Math.floor(secondi) : 0;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Le velocità del lettore, come WhatsApp: 1× → 1,5× → 2× → 1×. */
const VELOCITA = [1, 1.5, 2] as const;

export function velocitaDopo(v: number): number {
  const i = VELOCITA.indexOf(v as (typeof VELOCITA)[number]);
  return i < 0 ? 1 : VELOCITA[(i + 1) % VELOCITA.length];
}

/** La velocità scelta resta per i vocali dopo (anche dopo aver ricaricato la pagina):
 *  si salva su questo dispositivo. Un valore strano o mancante torna a 1×. */
const CHIAVE_VELOCITA = "hgl-vocale-velocita";
export function velocitaValida(v: unknown): number {
  const n = Number(v);
  return (VELOCITA as readonly number[]).includes(n) ? n : 1;
}
export function velocitaSalvata(): number {
  try {
    return velocitaValida(globalThis.localStorage?.getItem(CHIAVE_VELOCITA));
  } catch {
    return 1;
  }
}
export function salvaVelocita(v: number): void {
  try {
    globalThis.localStorage?.setItem(CHIAVE_VELOCITA, String(velocitaValida(v)));
  } catch {
    //  Archivio bloccato (navigazione privata): vale solo per questa pagina.
  }
}

export function etichettaVelocita(v: number): string {
  return `${String(v).replace(".", ",")}×`;
}

/** La forma d'onda finta di un vocale: `n` altezze fra 0,2 e 1, sempre le stesse
 *  per lo stesso indirizzo (il disegno non cambia a ogni aggiornamento). */
export function barreFinte(seme: string, n: number): number[] {
  //  FNV-1a sul testo, poi un generatore lineare: deterministico e senza dipendenze.
  let h = 2166136261;
  for (let i = 0; i < seme.length; i++) h = Math.imul(h ^ seme.charCodeAt(i), 16777619);
  const barre: number[] = [];
  for (let i = 0; i < n; i++) {
    h = (Math.imul(h, 1664525) + 1013904223) >>> 0;
    barre.push(Math.round((0.2 + (h / 2 ** 32) * 0.8) * 100) / 100);
  }
  return barre;
}

/** Dove si è toccata la barra di avanzamento, da 0 a 1 (fuori dalla barra: il bordo). */
export function quotaDaPunto(x: number, sinistra: number, larghezza: number): number {
  if (!(larghezza > 0)) return 0;
  return Math.min(1, Math.max(0, (x - sinistra) / larghezza));
}

/** Il giorno di calendario a Roma: come i separatori della conversazione. */
const giornoRoma = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Europe/Rome" });

/** Messaggi consecutivi dello stesso lato e dello stesso giorno stanno vicini (come WhatsApp). */
export function attaccataAllaPrecedente(
  m: { direction: string; created_at: string },
  prima: { direction: string; created_at: string } | null,
): boolean {
  if (!prima || prima.direction !== m.direction) return false;
  const a = new Date(m.created_at);
  const b = new Date(prima.created_at);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return false;
  return giornoRoma(a) === giornoRoma(b);
}

/** «Annulla» dopo la X: torna il testo cancellato. Se nel frattempo si è scritto
 *  altro, non si perde niente: il testo cancellato va sopra, il nuovo sotto. */
export function bozzaDopoAnnulla(cancellata: string, attuale: string): string {
  if (!cancellata) return attuale;
  return attuale.trim() ? `${cancellata.trimEnd()}\n\n${attuale}` : cancellata;
}
