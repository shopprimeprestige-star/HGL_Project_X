/** ── UN SOLO AVVISO, E LA FRASE DEL GIRO ───────────────────────────────────
 *
 *  Commessa 2026-10-28 «Lead importati semplice». I tre avvisi separati di
 *  prima (richiami scaduti, messi da parte da più di 3 giorni, ritorni da
 *  decidere) diventano UNA fascia sottile con tre voci, ognuna cliccabile col
 *  suo numero. Senza voci non c'è la fascia.
 *
 *  ⚠️ IL NUMERO SCRITTO DEVE ESSERE LE RIGHE CHE SI APRONO. I richiami scaduti
 *   aprono lo Stato «Richiami», che mostra anche quelli non ancora scaduti; i
 *   messi da parte aprono la stanza con tutti i messi da parte, non solo quelli
 *   da più di 3 giorni. Quando i due numeri differiscono il testo li dice
 *   entrambi («19 richiami scaduti (23 in tutto)»), così il conto non mente
 *   senza aggiungere un filtro che la SPEC non vuole. `n` è il numero scritto,
 *   `righe` quelle che si vedono aprendo.
 *  ⚠️ NIENTE AVVISO «Attesa WhatsApp oltre 10 ore» (revisione 28/10): chi ha
 *   risposto in chat resta in attesa per scelta e la pagina non vede le risposte.
 *  ⚠️ `fraseGiro` SI CHIAMA SEMPRE CON LA CODA INTERA, non con la fetta dei
 *   filtri: così il numero della frase è quello di «Tutta la coda».
 *  ───────────────────────────────────────────────────────────────────────── */
import type { StatoFiltro } from "./filtri-lista";

export type VoceAvviso = {
  chiave: "scaduti" | "daParte" | "ritorni";
  testo: string;
  /** Il numero scritto nel testo. */
  n: number;
  /** Le righe che si vedono aprendo la voce. */
  righe: number;
  apre: { stato: StatoFiltro } | { vista: "saltati" };
};

const intero = (x: number) => Math.max(0, Math.floor(Number(x)) || 0);

export function avvisiPagina(c: {
  /** Richiami scaduti (`contaPromesse().scadute`). */
  scaduti: number;
  /** Tutti i richiami concordati arrivati, scaduti o no: sono le righe di «Richiami». */
  scadutiTutte: number;
  /** Messi da parte da più di 3 giorni. */
  daParte: number;
  /** Tutti i messi da parte: sono le righe della stanza. */
  daParteTutti: number;
  /** Ritorni ancora da decidere (lo stesso numero della pillola «Di ritorno»). */
  ritorni: number;
}): VoceAvviso[] {
  const voci: VoceAvviso[] = [];
  const scaduti = intero(c.scaduti);
  if (scaduti > 0) {
    const righe = Math.max(scaduti, intero(c.scadutiTutte));
    voci.push({
      chiave: "scaduti",
      testo: `${scaduti} ${scaduti === 1 ? "richiamo scaduto" : "richiami scaduti"}${
        righe > scaduti ? ` (${righe} in tutto)` : ""
      }`,
      n: scaduti,
      righe,
      apre: { stato: "promesse" },
    });
  }
  const daParte = intero(c.daParte);
  if (daParte > 0) {
    const righe = Math.max(daParte, intero(c.daParteTutti));
    voci.push({
      chiave: "daParte",
      testo: `${daParte} ${daParte === 1 ? "messo" : "messi"} da parte da più di 3 giorni${
        righe > daParte ? ` (${righe} in tutto)` : ""
      }`,
      n: daParte,
      righe,
      apre: { vista: "saltati" },
    });
  }
  const ritorni = intero(c.ritorni);
  if (ritorni > 0) {
    voci.push({
      chiave: "ritorni",
      testo: `${ritorni} ${ritorni === 1 ? "ritorno" : "ritorni"} da decidere`,
      n: ritorni,
      righe: ritorni,
      apre: { stato: "ritorno" },
    });
  }
  return voci;
}

/** La versione corta per il telefono: «3 cose da guardare». Vuota = niente fascia. */
export function fraseAvvisi(v: VoceAvviso[]): string {
  if (v.length === 0) return "";
  return v.length === 1 ? "1 cosa da guardare" : `${v.length} cose da guardare`;
}

/** «74 da chiamare oggi · 12 fatti», oppure «Sei in pari». `daProvare` = quelli
 *  della coda non ancora passati in fondo; `fatti` = il resto della coda. */
export function fraseGiro(daProvare: number, fatti: number): string {
  const d = intero(daProvare);
  const f = intero(fatti);
  const fatto = f === 1 ? "1 fatto" : `${f} fatti`;
  if (d === 0) return f > 0 ? `Sei in pari · ${fatto}` : "Sei in pari";
  return f > 0 ? `${d} da chiamare oggi · ${fatto}` : `${d} da chiamare oggi`;
}
