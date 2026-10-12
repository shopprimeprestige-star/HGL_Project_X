/** ── QUANTO PESA UNA REGISTRAZIONE, E QUANDO SI SPEZZA ─────────────────────
 *
 *  Segnalazione del committente: «la registrazione della consulenza registra
 *  1,30 minuti a botta, e se li apro neanche partono».
 *
 *  ⚠️ MISURATO, NON DEDOTTO. Due parti scaricate dall'archivio (9 ottobre):
 *      H.264 1280×720 · ~61 fotogrammi/s · 3,4–3,5 Mbit/s · 93–97 secondi
 *   e ffmpeg segnala «non monotonically increasing dts» lungo tutto il file.
 *
 *  DUE CAUSE, E SI SOMMANO.
 *  1. La parte si chiudeva a 40 MB fissi, per stare sotto i 50 MB per file
 *     del piano gratuito di Supabase. A 3,5 Mbit/s 40 MB sono 93 secondi: una
 *     consulenza di 45 minuti diventava trenta voci in archivio.
 *  2. I fotogrammi erano 60 al secondo: la tela delle camere consegnava un
 *     fotogramma a ogni giro dello schermo, e lo schermo condiviso chiedeva
 *     30 «ideali», che il browser prende come un consiglio. Per una
 *     videoconsulenza 15 bastano; 60 quadruplicano il peso, e i fotogrammi
 *     consegnati a scatti irregolari sono quelli che lasciano i tempi del
 *     file fuori ordine — il motivo per cui alcuni lettori (QuickTime sul
 *     Mac) non lo aprono.
 *
 *  ⚠️ LA SOGLIA SEGUE IL TETTO VERO DELL'ARCHIVIO. Sul piano gratuito il tetto
 *   resta 50 MB e spezzare è l'unico modo di non perdere la consulenza: lì si
 *   continua come prima. Quando il tetto del secchio viene alzato (piano Pro),
 *   la consulenza intera sta in un file solo — con un massimo, perché il file
 *   vive nella memoria del browser fino alla fine, e una registrazione di tre
 *   ore non deve poter far cadere la scheda.
 *  ───────────────────────────────────────────────────────────────────────── */

/** Fotogrammi al secondo della registrazione: schermo e camere. */
export const FOTOGRAMMI_REGISTRAZIONE = 15;

const MB = 1024 * 1024;
/** La soglia di sempre: sta sotto i 50 MB del piano gratuito con margine. */
export const SOGLIA_PIANO_GRATUITO = 40 * MB;
/** Sotto questo tetto il secchio è ancora quello gratuito, o quasi. */
const TETTO_MINIMO_FILE_UNICO = 200 * MB;
/** Il massimo che si tiene in memoria prima di chiudere comunque una parte. */
export const SOGLIA_MASSIMA = 1536 * MB;

/** Quanti byte può pesare una parte prima di chiuderla e aprirne un'altra.
 *  `tetto` = il limite per file del secchio, in byte (0 o assente = non si sa). */
export function sogliaParte(tetto: number | null | undefined): number {
  const t = Number(tetto) || 0;
  //  Tetto ignoto o piccolo: si resta sulla strada sicura.
  if (t < TETTO_MINIMO_FILE_UNICO) return SOGLIA_PIANO_GRATUITO;
  //  Il 20% di margine: il peso arriva a scatti di un secondo, e l'ultimo
  //  pezzo non deve far sforare il tetto.
  return Math.min(Math.floor(t * 0.8), SOGLIA_MASSIMA);
}

/** È il momento di consegnare un fotogramma? Tiene il ritmo a `fps` anche
 *  quando chi chiama gira più veloce (lo schermo a 60 Hz) o a scatti. */
export function tocca(ultimo: number, adesso: number, fps = FOTOGRAMMI_REGISTRAZIONE): boolean {
  if (!ultimo) return true;
  //  Un millisecondo di tolleranza: a 60 Hz i giri arrivano ogni 16,6 ms, e
  //  senza margine il quarto giro (66,4 ms) cadrebbe appena sotto i 66,7.
  return adesso - ultimo >= 1000 / fps - 1;
}
