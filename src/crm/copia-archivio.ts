/** ── L'ARCHIVIO NON SI RISCARICA TUTTO A OGNI APERTURA ──────────────────────
 *
 *  Segnalazione del committente: «la mia dashboard del CRM è molto lenta».
 *
 *  Misurato sull'archivio vero: 1.033 schede, 1,17 MB di JSON, scaricate per
 *  INTERO a ogni apertura della pagina — e in due viaggi, perché il server ne
 *  dà al massimo mille per volta. Prima che finisse, il CRM non disegnava
 *  niente: `setLoading(true)` fino all'ultimo blocco.
 *
 *  Qui ci sono le tre regole che servono a non rifarlo ogni volta, tenute
 *  separate dalla pagina perché si possano provare senza browser:
 *   · `filoDellArchivio` → da dove ripartire (l'ultima modifica vista);
 *   · `fondiSchede`      → la copia di prima più quello che è cambiato;
 *   · `copiaAttendibile` → quando fidarsi della copia e quando rifare tutto.
 *
 *  ⚠️ LE CANCELLAZIONI NON SI VEDONO NEL «CAMBIATO DOPO». Una scheda
 *   eliminata non torna in nessuna risposta: si accorge solo il CONTEGGIO. Per
 *   questo la copia si accetta solo se il numero di righe combacia con quello
 *   che il server dice di avere — e se non combacia si riscarica tutto, che è
 *   la cosa lenta ma giusta.
 *  ⚠️ E LA COPIA STA NELLA MEMORIA DELLA SCHEDA, non in quella del computer:
 *   dentro ci sono nomi, telefoni ed email di clienti veri, e una copia che
 *   resta sul disco dopo aver chiuso la scheda è un archivio di persone
 *   lasciato in un browser che può essere di famiglia.
 *  ───────────────────────────────────────────────────────────────────────── */

export type SchedaMinima = { id?: unknown; updated_at?: unknown; created_at?: unknown };

const testo = (v: unknown): string => (typeof v === "string" ? v : v == null ? "" : String(v));

/** L'ultima modifica vista: è il filo da cui ripartire. "" se non si sa. */
export function filoDellArchivio(schede: SchedaMinima[] | null | undefined): string {
  let max = "";
  for (const s of schede ?? []) {
    const t = testo(s?.updated_at);
    if (t && t > max) max = t;
  }
  return max;
}

/** La copia di prima, più quello che è cambiato dopo.
 *  ⚠️ L'ORDINE RESTA QUELLO DELL'ARCHIVIO — dalla più recente alla più
 *   vecchia per data di creazione — se no le schede ballerebbero sotto le dita
 *   a ogni aggiornamento. */
export function fondiSchede<T extends SchedaMinima>(vecchie: T[] | null | undefined, nuove: T[] | null | undefined): T[] {
  const per = new Map<string, T>();
  for (const s of vecchie ?? []) { const id = testo(s?.id); if (id) per.set(id, s); }
  //  Le nuove vincono sempre: sono la versione più fresca della stessa riga.
  for (const s of nuove ?? []) { const id = testo(s?.id); if (id) per.set(id, s); }
  return [...per.values()].sort((a, b) => testo(b?.created_at).localeCompare(testo(a?.created_at)));
}

/** Ci si può fidare della copia? Solo se le righe sono quelle che il server
 *  dice di avere: è l'unico modo di accorgersi di una cancellazione. */
export function copiaAttendibile(p: { quante?: number; sulServer?: number | null }): boolean {
  const q = Number(p.quante);
  const s = p.sulServer;
  if (!Number.isFinite(q) || q <= 0) return false;
  //  ⚠️ Se il conteggio non si sa (rete, permessi) NON si butta via la copia:
  //   mostrarla è comunque meglio di una pagina vuota, e il giro del
  //   «cambiato dopo» la tiene aggiornata.
  if (s == null || !Number.isFinite(Number(s))) return true;
  return q === Number(s);
}
