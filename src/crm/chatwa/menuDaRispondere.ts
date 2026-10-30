/** ── IL NUMERETTO «DA RISPONDERE»: LA LETTURA, SENZA RETE ─────────────────────
 *
 *  Estratto da `useDaRispondere` (30/10/2026) per poterlo provare con un database finto: qui
 *  niente React, niente Supabase. L'hook passa le due letture vere.
 *
 *  La regola è `contaDaRispondere` di ./stato (la stessa della pagina). Il contatto però dice
 *  soltanto «l'ultimo messaggio è in uscita» (`ultimo_messaggio_direzione`), non se è PARTITO: il
 *  trigger lo scrive anche per un nostro invio `failed` (ManyChat registra i rifiuti). La pagina
 *  quel messaggio lo vede e non chiude la chat; il numeretto deve fare lo stesso. Quindi, per i
 *  SOLI contatti che l'ultimo messaggio nostro toglierebbe dall'attesa (pochi), si chiede quali di
 *  quegli invii sono `failed`: quei contatti restano in attesa.
 *  Se la lettura dei falliti non riesce, il conto è «non so» (`null`): l'hook tiene il numero di prima. */
import type { WaContactRow } from "./tipi";
import { colonnaMancante, contaDaRispondere, daRispondere, type EsitoDb } from "./stato";

/** Il tetto di righe per richiesta di Supabase è 1000: si legge a pagine. */
const PAGINA = 1000;
/** shortcut: al massimo 5000 contatti con messaggi in entrata, oltre il numero
 *  si ferma lì (sotto-stima); quando succede, passare a un conteggio sul server. */
const MAX_PAGINE = 5;
/** Quanti numeri per richiesta dei falliti. */
const BLOCCO_FALLITI = 100;

export const COLONNE_BASE = "id,phone_e164,ultimo_in_entrata_il,risposto_il,ultimo_in_entrata_anteprima";
export const COLONNE = `${COLONNE_BASE},ultimo_messaggio_il,ultimo_messaggio_direzione`;

export type RigaMenu = Pick<
  WaContactRow,
  | "id"
  | "phone_e164"
  | "ultimo_in_entrata_il"
  | "risposto_il"
  | "ultimo_in_entrata_anteprima"
  | "ultimo_messaggio_il"
  | "ultimo_messaggio_direzione"
>;

/** Le due letture vere. `contatti`: una pagina con le colonne chieste. `fallitiDi`: dei numeri dati, gli
 *  invii nostri `failed` con `created_at` ≥ `dal` (ISO), come `{ to_number, created_at }`. */
export interface PorteMenu {
  contatti: (colonne: string, da: number, a: number) => Promise<EsitoDb>;
  fallitiDi: (numeri: string[], dal: string) => Promise<{ to_number: string; created_at: string }[] | null>;
}

const ms = (x: string | null | undefined) => {
  const t = Date.parse(String(x ?? ""));
  return Number.isFinite(t) ? t : null;
};
const nove = (t: string | null | undefined) => String(t ?? "").replace(/\D/g, "").slice(-9);

/** Quante chat sono in attesa; `null` a qualunque errore (l'hook tiene il numero di prima). */
export async function contaDalDatabase(porte: PorteMenu, adesso: Date): Promise<number | null> {
  try {
    let colonne = COLONNE;
    const righe: RigaMenu[] = [];
    for (let p = 0; p < MAX_PAGINE; p++) {
      let r = await porte.contatti(colonne, p * PAGINA, (p + 1) * PAGINA - 1);
      //  Migrazione dell'ultimo messaggio non applicata: si conta come prima (solo `risposto_il`).
      if (r.error && colonne === COLONNE && colonnaMancante(r.error)) {
        colonne = COLONNE_BASE;
        r = await porte.contatti(colonne, p * PAGINA, (p + 1) * PAGINA - 1);
      }
      if (r.error || !r.data) return null;
      const pagina = r.data as RigaMenu[];
      righe.push(...pagina);
      if (pagina.length < PAGINA) break;
    }
    //  Chi l'ultimo messaggio nostro toglie dall'attesa: in attesa senza quelle due colonne, fuori con.
    const senzaUltimo = (r: RigaMenu): RigaMenu => ({
      ...r,
      ultimo_messaggio_il: null,
      ultimo_messaggio_direzione: null,
    });
    const chiusi = righe.filter(
      (r) =>
        !daRispondere({ contatto: r, messaggi: [], adesso }).attesa &&
        daRispondere({ contatto: senzaUltimo(r), messaggi: [], adesso }).attesa,
    );
    let aggiunti = 0;
    if (chiusi.length > 0) {
      const dal = new Date(Math.min(...chiusi.map((r) => ms(r.ultimo_messaggio_il) ?? Infinity))).toISOString();
      const falliti = new Set<string>();
      for (let i = 0; i < chiusi.length; i += BLOCCO_FALLITI) {
        const blocco = chiusi.slice(i, i + BLOCCO_FALLITI);
        const numeri = blocco.flatMap((r) => [r.phone_e164, r.phone_e164.replace(/\D/g, "")]);
        const f = await porte.fallitiDi(numeri, dal);
        if (!f) return null;
        for (const m of f) falliti.add(`${nove(m.to_number)}|${ms(m.created_at)}`);
      }
      //  L'ultimo messaggio nostro è proprio quello fallito (stesso numero, stesso istante): il cliente aspetta.
      aggiunti = chiusi.filter((r) => falliti.has(`${nove(r.phone_e164)}|${ms(r.ultimo_messaggio_il)}`)).length;
    }
    return contaDaRispondere(righe, adesso) + aggiunti;
  } catch {
    return null;
  }
}
