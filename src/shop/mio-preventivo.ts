/** ── IL SUO PREVENTIVO VINCE SU TUTTO ──────────────────────────────────────
 *
 *  Richiesta del committente: «quando il suo preventivo è acceso, qualsiasi
 *  cosa attivo — videocamera, contenuti, qualsiasi cosa — all'utente deve
 *  rimanere il suo preventivo; se lo spengo mostrerà quello che sto
 *  condividendo io».
 *
 *  È una regola di PRECEDENZA, e per questo sta in un posto solo: mentre una
 *  persona ha il proprio preventivo acceso, il suo schermo non si muove più
 *  dietro al consulente. Non cambia modalità quando lui passa alle facce, non
 *  cambia pagina quando lui apre i media. Continua a compilare il suo.
 *
 *  ⚠️ STA IN UN FILE SUO, come `preparazione-privata`, e per lo stesso motivo
 *   meccanico: lo accende shop/call (che segue la regia) e lo legge shop/live
 *   (che smette di portarlo in giro). shop/live importa già shop/call, quindi
 *   metterlo in uno dei due chiuderebbe un anello.
 *  ⚠️ QUANDO SI SPEGNE NON SI DECIDE NIENTE: si torna semplicemente a seguire
 *   il consulente, e la prima cosa che arriva rimette il cliente in riga. Il
 *   suo preventivo resta dov'è, con dentro tutto quello che aveva scelto:
 *   riaccendendolo riprende da lì (la sua stanza non viene mai svuotata).
 *  ───────────────────────────────────────────────────────────────────────── */

/*  ── ⚠️ E NON PUÒ VIVERE DENTRO UNA SCHERMATA ─────────────────────────────
    Seconda segnalazione sulla stessa cosa: «se passo ai media, al cliente con
    il preventivo attivo passa ai media uguale».
    La prima volta l'avevo misurata e teneva — ma l'avevo misurata da fermo. La
    parte che alzava questa bandierina stava dentro lo strato dell'ospite,
    SOTTO le sue uscite anticipate: il velo «mi sto collegando», la sala
    d'attesa, il gate del nome. Ognuna di quelle uscite SMONTA il pezzo che
    tiene alta la precedenza — e la chiamata ci passa da sola, a ogni
    riconnessione e a ogni cambio di stato. In quel momento la bandierina
    cadeva, il giro che fa seguire il consulente (shop/live) trovava strada
    libera e il cliente finiva sui media. Dal di fuori: «non funziona».
    Perciò adesso la tiene il MOTORE (`vigilaSulMioPreventivo` in shop/call),
    che vive quanto la scheda e non ha schermate: le schermate si limitano a
    chiedergli com'è andata. */

let acceso = false;
const ascolti = new Set<(v: boolean) => void>();

/** Lo chiama il motore della consulenza quando legge la regia (shop/call). */
export function segnaMioPreventivo(v: boolean) {
  if (acceso === v) return;
  acceso = v;
  console.log(v
    ? "[GUEST] il mio preventivo è acceso: resto qui, qualunque cosa mostri il consulente"
    : "[GUEST] il mio preventivo è spento: torno a seguire il consulente");
  for (const f of [...ascolti]) { try { f(v); } catch { /* un ascoltatore rotto non ferma gli altri */ } }
}

/** Questo cliente deve restare sul proprio preventivo? */
export const restaSulMioPreventivo = (): boolean => acceso;

/** Chi disegna vuole saperlo APPENA cambia, non al prossimo giro: la pagina
 *  del preventivo va aperta subito, non entro un secondo.
 *  Restituisce la funzione per smettere di ascoltare. */
export function ascoltaMioPreventivo(f: (v: boolean) => void): () => void {
  ascolti.add(f);
  return () => { ascolti.delete(f); };
}
