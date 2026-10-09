/** ── SCARICARE I FILE ──────────────────────────────────────────────────────
 *  Due gesti soli: un file, o tanti file.
 *
 *  ⚠️ NIENTE ARCHIVIO ZIP, e non è una rinuncia: comprimere richiederebbe una
 *   libreria per un gesto che si fa dieci volte l'anno, e il commercialista i
 *   file XML li vuole sciolti — è così che li importa nel gestionale, uno per
 *   uno o trascinandoli tutti insieme. Uno zip glielo farebbe solo scompattare.
 *  ───────────────────────────────────────────────────────────────────────── */

/** Un file, dal contenuto in memoria. L'oggetto URL si libera dopo, altrimenti
 *  ogni download lascia in memoria una copia del file finché la scheda è
 *  aperta. */
export function scaricaTesto(nome: string, contenuto: string, tipo: string): void {
  const blob = new Blob([contenuto], { type: `${tipo};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  //  Un istante dopo: revocarlo subito, su Safari, annulla il download appena
  //  cominciato.
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export const scaricaXml = (nome: string, xml: string) => scaricaTesto(nome, xml, "application/xml");

/** ── TANTI FILE IN FILA ────────────────────────────────────────────────────
 *  ⚠️ UNO ALLA VOLTA, CON UNA PAUSA. Trenta `click()` nello stesso giro di
 *   eventi non sono trenta download: i browser li considerano un tentativo di
 *   sommergere l'utente e ne lasciano passare uno o due, silenziosamente. Con
 *   un intervallo passano tutti.
 *  ⚠️ E LA PRIMA VOLTA IL BROWSER CHIEDE IL PERMESSO per i download multipli:
 *   chi chiama deve dirlo prima di far partire il gesto, altrimenti sembra che
 *   ne siano arrivati due su trenta senza motivo. */
export async function scaricaInFila(
  file: { nome: string; contenuto: string; tipo: string }[],
  avanza?: (fatti: number, totale: number) => void,
): Promise<void> {
  for (let i = 0; i < file.length; i++) {
    scaricaTesto(file[i].nome, file[i].contenuto, file[i].tipo);
    avanza?.(i + 1, file.length);
    if (i < file.length - 1) await new Promise((r) => setTimeout(r, 350));
  }
}
