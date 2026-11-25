/** ── SCRIVERE UN CSV E «SCARICA LE RIGHE DA CORREGGERE» (EDITOR PRODOTTI · E2b) ─
 *  SPEC §6.4. Il file che si scarica ha le sole righe respinte, le stesse colonne del file caricato e in più «Errore»: si corregge e si ricarica.
 *  È un file che si apre in Excel, quindi ogni cella che potrebbe diventare una formula (`=`, `+`, `-`, `@`, tab, a capo) prende un apice davanti,
 *  anche se prima ha degli spazi (« =CMD()»). Il dato nel database non si cambia: la protezione è solo nel file che esce. */
import type { ErroreRiga } from "./import-contratto";

/** Dopo gli spazi iniziali, una cella che comincia con uno di questi è una formula per Excel e Fogli. */
const FORMULA = /^[  ]*[=+\-@\t\r]/;

/** La cella al sicuro: con un apice davanti se potrebbe essere una formula. */
export const proteggiCella = (t: string): string => (FORMULA.test(t) ? `'${t}` : t);

const cellaCsv = (t: string, sep: string, proteggi: boolean): string => {
  const x = proteggi ? proteggiCella(t) : t;
  return x.includes('"') || x.includes(sep) || /[\n\r]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x;
};

/** Righe di celle → testo CSV (UTF-8 con il segno iniziale di Excel, a capo CRLF). Lineare: si accumula in un elenco e si unisce una volta. */
export function scriviCsv(righe: readonly (readonly string[])[], sep: "," | ";" = ",", proteggi = true): string {
  return `﻿${righe.map((r) => r.map((c) => cellaCsv(c, sep, proteggi)).join(sep)).join("\r\n")}\r\n`;
}

/** Il CSV con le sole righe respinte (tutte le righe di ogni prodotto in errore, così si riprende intero) e la colonna «Errore». */
export function righeDaCorreggere(record: readonly (readonly string[])[], errori: readonly ErroreRiga[], sep: "," | ";" = ","): string {
  const frasi = new Map<number, string[]>();
  const scelte = new Set<number>();
  for (const e of errori) {
    if (e.riga >= 2) {
      scelte.add(e.riga);
      const f = frasi.get(e.riga) ?? [];
      f.push(e.frase);
      frasi.set(e.riga, f);
    }
    for (const r of e.righeProdotto ?? []) if (r >= 2) scelte.add(r);
  }
  const intestazione = record[0] ?? [];
  const fuori: string[][] = [[...intestazione, "Errore"]];
  for (const riga of [...scelte].sort((a, b) => a - b)) {
    const celle = record[riga - 1];
    if (celle) fuori.push([...celle, (frasi.get(riga) ?? []).join(" | ")]);
  }
  return scriviCsv(fuori, sep);
}
