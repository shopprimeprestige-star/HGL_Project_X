/** ── CHE COSA STA SUONANDO SUL TELEFONO DEL CLIENTE ────────────────────────
 *
 *  Segnalazione del committente: «l'utente quando sta dentro sente bip bip
 *  bip». Precisato: lo sente IL CLIENTE, mentre è già dentro, e si ripete in
 *  continuazione ogni pochi secondi.
 *
 *  ── PERCHÉ ESISTE QUESTO FILE ────────────────────────────────────────────
 *  Il guasto succede sul dispositivo di una persona che sta facendo una
 *  consulenza vera: non c'è una console da guardare, non si può chiedere a lei
 *  di aprire gli strumenti da sviluppatore, e quando la consulenza finisce non
 *  resta niente. Di suoni, su quella pagina, ne possono partire di due nature
 *  diverse — quelli che facciamo noi apposta (`shop/sfx`) e le riprese del
 *  lettore audio della chiamata, che su un telefono si sentono come uno
 *  scatto — e indovinare quale sia dei due è esattamente il modo in cui questo
 *  genere di segnalazione si trascina per settimane.
 *
 *  Qui si CONTA, e ogni tanto si lascia detta una riga sola nel diario del
 *  cliente (api.presenter.errors, che è aperto in scrittura proprio per questo).
 *  Alla prossima consulenza si legge «negli ultimi 20s: audio-ripreso ×10» e si
 *  sa, invece di tentare.
 *
 *  ⚠️ NON CI FINISCE NIENTE DI PRIVATO: nomi di suoni e numeri. Nessun
 *   contenuto, nessun nome di persona.
 *  ⚠️ UNA RIGA SOLA OGNI TANTO, e solo se è successo qualcosa: un diario che
 *   scrive anche quando non c'è niente da dire è un diario che non si legge.
 *  ⚠️ I CONTEGGI SI AZZERANO A OGNI RIGA, così ogni riga parla della sua
 *   finestra e due righe di fila si possono confrontare.
 *  ───────────────────────────────────────────────────────────────────────── */

/** Quante volte ciascun suono, da quando si è azzerato. */
export type Conteggi = Record<string, number>;

export function conta(dove: Conteggi, nome: string): Conteggi {
  const n = String(nome || "").trim().slice(0, 24);
  if (!n) return dove;
  dove[n] = (dove[n] ?? 0) + 1;
  return dove;
}

export const quanti = (dove: Conteggi): number =>
  Object.values(dove).reduce((t, n) => t + n, 0);

/** La riga da scrivere nel diario. Stringa vuota = non c'è niente da dire, e
 *  allora non si scrive niente.
 *  ⚠️ L'ordine è dal più frequente: la prima voce della riga è il sospettato. */
export function riassunto(dove: Conteggi, secondi: number): string {
  const voci = Object.entries(dove)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  if (!voci.length) return "";
  const s = Math.max(1, Math.round(secondi));
  return `SUONI · negli ultimi ${s}s: ${voci.map(([k, n]) => `${k}×${n}`).join(", ")}`;
}
