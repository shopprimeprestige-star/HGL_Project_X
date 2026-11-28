/** ── I PRODOTTI DAL CESTINO NELL'IMPORT (importa-ripristino.ts) ─────────────────────
 *  Commessa 2026-11-25-editor-prodotti, E15. Un indirizzo del file che esiste ma è `archiviato` (E14) non si ricrea e non è «già presente»:
 *  torna in bozza, a pezzi da 20 (`aGruppi`), con la stessa azione di «Rimetti in bozza» (`gruppo_stato`). Qui i passi di UN pezzo; l'ordine
 *  (prima i pezzi, poi i gruppi dei nuovi), la ripresa e il riepilogo stanno in `importa-flusso.ts`, che ri-esporta questo file. Puro, nessuna rete. */
import { FRASE_RISPOSTA, eOggetto, eTesto } from "./importa-analisi";
import type { Fermo, StatoGruppo, StatoImporta } from "./importa-flusso";

/** Un pezzo (al massimo 20) di prodotti del Cestino da rimettere in bozza. */
export interface PezzoRipristino {
  prodotti: { handle: string; prodottoId: string }[];
  stato: StatoGruppo;
  /** Solo a pezzo fatto: quelli che il server NON ha rimesso in bozza, con la sua frase (sono respinti). */
  restano: { handle: string; frase: string }[];
}
export const pezziDi = (s: Pick<StatoImporta, "ripristino">): PezzoRipristino[] =>
  s.ripristino ?? [];

/** Il primo pezzo del Cestino non ancora fatto, o `null`. */
export function prossimoPezzo(s: StatoImporta): number | null {
  const i = pezziDi(s).findIndex((p) => p.stato !== "fatto");
  return i < 0 ? null : i;
}

const cambiaPezzo = (
  s: StatoImporta,
  i: number,
  p: Partial<PezzoRipristino>,
  fermo: Fermo | null,
): StatoImporta => ({
  ...s,
  ripristino: pezziDi(s).map((x, k) => (k === i ? { ...x, ...p } : x)),
  fermo,
});

/** Un pezzo non rimesso in bozza (rete, server, risposta strana): resta da fare e si riprende. Rimandarlo è innocuo: la bozza è la stessa. */
export const fermaPezzo = (
  s: StatoImporta,
  i: number,
  errore: { tipo: string; messaggio: string },
): StatoImporta =>
  cambiaPezzo(
    s,
    i,
    { stato: "interrotto" },
    { tipo: errore.tipo, messaggio: errore.messaggio, incerto: false },
  );

/** La risposta di `gruppo_stato` per il pezzo `i`: `bozze` (numero) e `restano` ({id, motivo}) → chi non è tornato è respinto con la frase del server. */
export function registraRipristino(
  s: StatoImporta,
  i: number,
  dati: Record<string, unknown>,
): StatoImporta {
  if (typeof dati.bozze !== "number")
    return fermaPezzo(s, i, { tipo: "server", messaggio: FRASE_RISPOSTA });
  const fuori = new Map(
    (Array.isArray(dati.restano) ? dati.restano : [])
      .filter((x): x is Record<string, unknown> => eOggetto(x) && eTesto(x.id))
      .map((x) => [
        x.id as string,
        eTesto(x.motivo) ? x.motivo : "il server non ha dato il motivo.",
      ]),
  );
  const restano = pezziDi(s)
    [i].prodotti.filter((p) => fuori.has(p.prodottoId))
    .map((p) => ({
      handle: p.handle,
      frase: `Non è tornato in bozza dal Cestino: ${fuori.get(p.prodottoId)}`,
    }));
  return cambiaPezzo(s, i, { stato: "fatto", restano }, null);
}
