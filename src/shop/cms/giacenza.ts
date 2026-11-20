/** ── LA GIACENZA: MAI SOTTO ZERO ────────────────────────────────────────────
 *  Commessa 2026-11-20-shop-completo (T06). Modulo PURO: la stessa regola che il database applica con
 *  `shop_giacenza_muovi` (PIANO D7), qui per dare subito la frase al titolare e per le prove.
 *  Il pubblico vede solo «disponibile» o «esaurito»: il numero non esce mai dal server (SPEC Modulo 1). */

export type EsitoMovimento =
  | { ok: true; giacenza: number }
  | { ok: false; motivo: "giacenza_negativa" | "movimento_nullo" | "non_valido"; frase: string };

const intero = (n: unknown): n is number => typeof n === "number" && Number.isSafeInteger(n);

/** La giacenza dopo un movimento (`delta` positivo = carico, negativo = scarico). Sotto zero non si va. */
export function applicaMovimento(attuale: unknown, delta: unknown): EsitoMovimento {
  if (!intero(attuale) || attuale < 0 || !intero(delta) || !Number.isSafeInteger(attuale + delta))
    return { ok: false, motivo: "non_valido", frase: "La quantità deve essere un numero intero, senza virgole." };
  if (delta === 0) return { ok: false, motivo: "movimento_nullo", frase: "Il movimento è zero: la giacenza non cambia." };
  const dopo = attuale + delta;
  if (dopo < 0)
    return { ok: false, motivo: "giacenza_negativa", frase: `La giacenza non può andare sotto zero: ce ne sono ${attuale} e se ne togliono ${-delta}.` };
  return { ok: true, giacenza: dopo };
}

/** Quel che vede il pubblico. Nel dubbio (numero storto) non si vende. */
export const statoDisponibilita = (giacenza: unknown, attiva = true): "disponibile" | "esaurito" =>
  attiva && intero(giacenza) && giacenza > 0 ? "disponibile" : "esaurito";

/** Avviso per chi gestisce: restano pochi pezzi (da 1 fino alla soglia, estremi compresi). Lo zero è «esaurito», un'altra scritta. */
export const giacenzaBassa = (giacenza: unknown, soglia: unknown): boolean =>
  intero(giacenza) && intero(soglia) && giacenza > 0 && giacenza <= soglia;
