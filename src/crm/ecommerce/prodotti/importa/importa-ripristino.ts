/** ── I PRODOTTI DAL CESTINO NELL'IMPORT (importa-ripristino.ts) ─────────────────────
 *  Commessa 2026-11-25-editor-prodotti, E15. Un indirizzo del file che esiste ma è `archiviato` (E14) non si ricrea e non è «già presente»:
 *  torna in bozza, a pezzi da 20 (`aGruppi`), con la stessa azione di «Rimetti in bozza» (`gruppo_stato`). Qui i passi di UN pezzo; l'ordine
 *  (prima i pezzi, poi i gruppi dei nuovi), la ripresa e il riepilogo stanno in `importa-flusso.ts`, che ri-esporta questo file. Puro, nessuna rete. */
import { aGruppi } from "../elenco-puro";
import {
  AZIONE_VERIFICA,
  FRASE_RISPOSTA,
  eOggetto,
  eTesto,
  type Analisi,
  type Esegui,
} from "./importa-analisi";
import type { Fermo, StatoGruppo, StatoImporta } from "./importa-flusso";

/** Un pezzo (al massimo 20) di prodotti del Cestino da rimettere in bozza. */
export interface PezzoRipristino {
  prodotti: { handle: string; prodottoId: string }[];
  stato: StatoGruppo;
  /** Solo a pezzo fatto: quelli che il server NON ha rimesso in bozza, con la sua frase (sono respinti). */
  restano: { handle: string; frase: string }[];
}
/** I prodotti dal Cestino a pezzi da 20, tutti da fare (`aGruppi`, lo stesso tetto di `gruppo_stato`). */
export const pezziDa = (
  prodotti: readonly { handle: string; prodottoId: string }[],
): PezzoRipristino[] =>
  aGruppi(prodotti.map((p) => p.prodottoId)).map((ids) => ({
    prodotti: prodotti
      .filter((p) => ids.includes(p.prodottoId))
      .map(({ handle, prodottoId }) => ({ handle, prodottoId })),
    stato: "da_fare",
    restano: [],
  }));

/** Il primo pezzo del Cestino non ancora fatto, o `null`. */
export function prossimoPezzo(s: StatoImporta): number | null {
  const i = s.ripristino.findIndex((p) => p.stato !== "fatto");
  return i < 0 ? null : i;
}

const cambiaPezzo = (
  s: StatoImporta,
  i: number,
  p: Partial<PezzoRipristino>,
  fermo: Fermo | null,
): StatoImporta => ({
  ...s,
  ripristino: s.ripristino.map((x, k) => (k === i ? { ...x, ...p } : x)),
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
  const restano = s.ripristino[i].prodotti
    .filter((p) => fuori.has(p.prodottoId))
    .map((p) => ({
      handle: p.handle,
      frase: `Non è tornato in bozza dal Cestino: ${fuori.get(p.prodottoId)}`,
    }));
  return cambiaPezzo(s, i, { stato: "fatto", restano }, null);
}

/** Prima di rimettere in bozza (a «Importa» e a «Riprendi»): rifà la SOLA verifica (sola lettura) per i pezzi ancora da fare. L'elenco dei «nel Cestino»
 *  viene dall'anteprima e può essere vecchio: chi nel frattempo non è più `archiviato` (rimesso in bozza o già pubblicato da un'altra scheda) NON si tocca
 *  e passa tra i «già presenti» (saltato, e per le foto vale come gli altri). Se la verifica non arriva si ferma con la sua frase, senza scrivere niente:
 *  «Riprendi» riprova. I pezzi già fatti non si rileggono. */
export async function riverificaCestino(
  analisi: Analisi,
  stato: StatoImporta,
  esegui: Esegui,
): Promise<{ analisi: Analisi; stato: StatoImporta }> {
  const handle = stato.ripristino.flatMap((p) =>
    p.stato === "fatto" ? [] : p.prodotti.map((x) => x.handle),
  );
  if (handle.length === 0) return { analisi, stato };
  const ferma = (tipo: string, messaggio: string) => ({
    analisi,
    stato: { ...stato, fermo: { tipo, messaggio, incerto: false } },
  });
  let r;
  try {
    r = await esegui(AZIONE_VERIFICA, { slugs: handle, skus: [] });
  } catch {
    return ferma(
      "rete",
      "Non riesco a controllare il Cestino: controlla la connessione e premi «Riprendi».",
    );
  }
  if (!r.ok) return ferma(r.errore.tipo, r.errore.messaggio);
  const presenti = r.dati.presenti;
  if (
    !Array.isArray(presenti) ||
    !presenti.every((x) => eOggetto(x) && eTesto(x.slug) && eTesto(x.stato))
  )
    return ferma("server", FRASE_RISPOSTA);
  const ancora = new Set(
    presenti.filter((x) => x.stato === "archiviato").map((x) => x.slug as string),
  );
  const cambiati = new Set(handle.filter((h) => !ancora.has(h)));
  if (cambiati.size === 0) return { analisi, stato };
  return {
    analisi: {
      ...analisi,
      dalCestino: analisi.dalCestino.filter((g) => !cambiati.has(g.handle)),
      giaPresenti: [
        ...analisi.giaPresenti,
        ...analisi.dalCestino.filter((g) => cambiati.has(g.handle)),
      ],
    },
    stato: {
      ...stato,
      // I pezzi fatti restano; chi manca ancora si ridivide a pezzi da 20.
      ripristino: [
        ...stato.ripristino.filter((p) => p.stato === "fatto"),
        ...pezziDa(
          stato.ripristino
            .filter((p) => p.stato !== "fatto")
            .flatMap((p) => p.prodotti)
            .filter((x) => !cambiati.has(x.handle)),
        ),
      ],
    },
  };
}
