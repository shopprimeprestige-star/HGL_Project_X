/** ── FATTURE DALLA CHAT · T12 · ABBINAMENTO PER NUMERO DI TELEFONO ──────────
 *  PIANO §2bis/§4 (T12), SPEC §9.3 passo 4, §9.7 criterio 2: Via 2 (dalle bolle
 *  scelte in chat). Il titolare è già dentro una chat, scelta per numero: qui
 *  si trova quali schede (`crm_leads`) hanno quello stesso numero, confrontando
 *  le ULTIME 9 CIFRE (stessa idea di `ultime9` in `bulk/doppioni-e-schede.ts` e
 *  `raccolta-chat.server.ts` — qui una copia propria, non importata: è pura
 *  aritmetica di stringa, generica, non vale un accoppiamento fra file).
 *
 *  Puro, client: nessuna query, nessun accesso a Supabase. Zero, una o più
 *  schede possono combaciare sullo stesso numero (es. madre e figlia che
 *  scrivono dallo stesso telefono di famiglia): questo file NON sceglie da
 *  solo quale sia quella giusta — le torna tutte, nell'ordine ricevuto, e la
 *  scelta resta del titolare (SPEC §9.3 passo 4), stesso principio già scelto
 *  per `abbinaScheda`/Via 1 di questa commessa: l'abbinamento non si indovina. */
import type { Lead } from "../../types";

/** Le ultime 9 cifre di un numero, o vuoto se non ce ne sono abbastanza per fidarsi. */
function ultime9(telefono: string): string {
  const cifre = String(telefono ?? "").replace(/\D/g, "");
  return cifre.length >= 9 ? cifre.slice(-9) : "";
}

/** Tutte le schede il cui telefono combacia (ultime 9 cifre) con quello della chat aperta.
 *  Un `telefono` troppo corto (meno di 9 cifre) non combacia con niente: non è un errore,
 *  è lo stesso caso limite già deciso per la Via 1 (SPEC §5, «nessuna chat trovata»). */
export function schedePerNumero(leads: readonly Lead[], telefono: string): Lead[] {
  const mio = ultime9(telefono);
  if (!mio) return [];
  return leads.filter((l) => ultime9(l.data.telefono ?? "") === mio);
}
