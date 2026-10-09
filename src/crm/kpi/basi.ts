// ── COME SI SCRIVE UN NUMERO IN QUESTA PAGINA ───────────────────────────────
//  Qui non si calcola nessun KPI: si DECIDE COME SI SCRIVE quello che le
//  formule hanno già calcolato. Sta in un file solo perché la regola vale per
//  tutte e quattro le schede, e una percentuale scritta con criteri diversi in
//  due schede sorelle fa sospettare due calcoli diversi.
//
//  ── LA REGOLA, UNA SOLA ───────────────────────────────────────────────────
//  Ogni percentuale si scrive CON LA SUA BASE: «41,7% · 5 su 12», mai «41,7%».
//  L'archivio di questa azienda contiene 843 schede importate, molte
//  incomplete: una conversione del 40% può essere 2 casi su 5, e con quel
//  numero si sposta un budget. Sotto la soglia di volume la percentuale non si
//  mostra affatto — si mostra un trattino e il motivo — perché una cifra
//  fragile letta senza il suo denominatore vale meno di nessuna cifra.
//
//  La soglia è quella che esisteva già (`VOLUME_MINIMO_LPS` in ./soglie) e non
//  se ne introduce una seconda: due tagli diversi nella stessa schermata fanno
//  sembrare rotta una delle due tabelle.

import { VOLUME_MINIMO_LPS } from "@/crm/kpi/soglie";

/* ═══════════════════════════════════════════════════════════════════════════
   FORMATI
   ═════════════════════════════════════════════════════════════════════════ */

/** ── EURO CON I CENTESIMI ──────────────────────────────────────────────────
 *  Costi unitari e spesa pubblicitaria si scrivono con i centesimi: un costo
 *  per lead di 8,30 € arrotondato a 8 € sposta del 4% il conto che chi legge si
 *  fa in testa, e la spesa scritta a mano deve tornare alla cifra con quello
 *  che si legge sul pannello degli annunci. Fatturato e margine restano senza
 *  decimali (`eur` di ui.tsx), dove i centesimi sono rumore su cifre a quattro
 *  zeri. */
export const euroPreciso = (n: number) =>
  `€ ${(Number.isFinite(n) ? n : 0).toLocaleString("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

/** Percentuale a un decimale. Un valore non finito (una divisione per zero
 *  sfuggita a monte) diventa un trattino: «NaN%» a schermo fa chiudere la
 *  pagina e non riaprirla più. */
export const pct = (n: number) => (Number.isFinite(n) ? `${n.toFixed(1)}%` : "—");

/** Moltiplicatore del ritorno sulla spesa: «3,20×». */
export const volte = (n: number) => (Number.isFinite(n) ? `${n.toFixed(2)}×` : "—");

/** Punteggio dichiarato nel modulo, da 1 a 10. */
export const punteggio = (n: number) => (Number.isFinite(n) ? `${n.toFixed(1)}/10` : "—");

/* ═══════════════════════════════════════════════════════════════════════════
   LA BASE DI UNA PERCENTUALE
   ═════════════════════════════════════════════════════════════════════════ */

export interface Base {
  /** Quello che si stampa dove sta il numero: «41,7%» oppure «—». */
  valore: string;
  /** Su quanti casi: «5 su 12», oppure il motivo per cui non si misura. */
  base: string;
  /** Numero e base insieme, per i posti dove ci sta una riga sola. */
  testo: string;
  /** Falso quando il denominatore è troppo piccolo (o nullo): chi legge deve
   *  poterlo trattare diversamente — colore spento, nessun confronto. */
  misurabile: boolean;
}

interface Opzioni {
  /** Come si chiamano i casi al plurale: «lead», «consulenze», «chiamate». */
  casi?: string;
  /** Soglia diversa da quella comune. Serve SOLO dove il denominatore non è un
   *  campione ma un totale certo (per esempio i giorni di un periodo). */
  minimo?: number;
}

/** ── LA FUNZIONE DA CUI PASSANO TUTTE LE PERCENTUALI DELLA PAGINA ──────────
 *  La percentuale si PASSA, non si ricalcola: arriva già fatta da
 *  `@/crm/kpi-calcoli`, che è la trascrizione fedele del CRM aziendale e non si
 *  tocca. Qui si aggiunge soltanto la base e si decide se mostrarla.
 *
 *  Il numeratore e il denominatore servono a due cose diverse: il primo si
 *  scrive accanto al numero, il secondo decide se il numero ha diritto di
 *  esistere. */
export function conBase(
  percentuale: number,
  numeratore: number,
  denominatore: number,
  opzioni: Opzioni = {},
): Base {
  const casi = opzioni.casi ?? "casi";
  const minimo = opzioni.minimo ?? VOLUME_MINIMO_LPS;
  const den = Number.isFinite(denominatore) ? denominatore : 0;
  const num = Number.isFinite(numeratore) ? numeratore : 0;

  if (den <= 0) {
    return { valore: "—", base: "nessun caso nel periodo", testo: "—", misurabile: false };
  }
  if (den < minimo) {
    //  Il denominatore si scrive lo stesso: «troppo pochi» senza dire quanti
    //  fa sembrare che il dato manchi, invece che essere piccolo.
    return {
      valore: "—",
      base: `troppo pochi ${casi} (${den})`,
      testo: "—",
      misurabile: false,
    };
  }
  const valore = pct(percentuale);
  const base = `${num} su ${den}`;
  return { valore, base, testo: `${valore} · ${base}`, misurabile: true };
}

/** La stessa dichiarazione per un numero che NON è una percentuale: un costo
 *  per cliente vale quanto i clienti su cui è diviso. Non nasconde niente —
 *  restituisce sempre il valore — ma obbliga a scrivere accanto su cosa è
 *  calcolato. */
export function suQuanti(n: number, singolare: string, plurale: string): string {
  return `su ${n} ${n === 1 ? singolare : plurale}`;
}
