/** ── DOVE SI BLOCCA, DETTO DALL'APPLICAZIONE STESSA ────────────────────────
 *
 *  Segnalazione del committente: «va troppo lento lato presentatore, Chrome
 *  dice continuamente non risponde, attendi». E, alle mie domande: «ovunque,
 *  anche appena apro» e «sempre lento».
 *
 *  Ho misurato quello che potevo misurare da qui — la pagina del consulente
 *  aperta e ferma, sul sito vero — e non si blocca mai: zero millisecondi di
 *  thread principale occupato in cinquanta secondi, una sola richiesta in
 *  trenta. Il blocco nasce quindi da qualcosa che accade sul SUO computer,
 *  nella SUA sessione, con i SUOI dati: la scheda del CRM piena, la camera
 *  accesa, l'anteprima dispositivo, ore di consulenza aperte.
 *
 *  «Non risponde, attendi» è la finestra che Chrome mostra quando il thread
 *  principale è occupato per DECINE di secondi. Non è «un po' di codice in
 *  più»: è un lavoro sincrono lungo. Indovinare quale, da fuori, è quello che
 *  ho già fatto quattro volte con il preventivo personale — e quattro volte
 *  non ha chiuso il giro. Quindi qui non si indovina: l'applicazione misura i
 *  propri blocchi, si ricorda che cosa stava facendo, e lo dice.
 *
 *  ⚠️ LA BRICIOLA, NON LA PILA DI CHIAMATE. Il browser dice QUANTO è durato un
 *   blocco, non CHI l'ha causato. Per sapere il chi, ogni pezzo di lavoro
 *   lungo lascia una briciola prima di partire (`staFacendo`) e la toglie
 *   quando ha finito. Il blocco che arriva porta con sé l'ultima briciola
 *   lasciata: non è una pila di chiamate, ma dice il reparto — e il reparto è
 *   quello che serve per andare a guardare.
 *  ⚠️ COSTO QUASI ZERO: un osservatore del browser (che gira per conto suo) e
 *   una variabile che cambia. Niente timer, niente campionamento: una misura
 *   che rallenta è una misura che si cancella da sola.
 *  ───────────────────────────────────────────────────────────────────────── */

export type Blocco = {
  /** Millisecondi di thread principale occupato. */
  ms: number;
  /** Che cosa stava facendo l'applicazione (l'ultima briciola). */
  cosa: string;
  /** Da quanti secondi era aperta la scheda. */
  da: number;
};

/** Sopra questo si parla di rallentamento percepito: mezzo secondo di thread
 *  fermo è un clic che non risponde. (La finestra di Chrome arriva molto più
 *  in là, ma chi lavora se ne accorge molto prima.) */
export const SOGLIA_MS = 500;
/** Quanti blocchi si tengono: gli ultimi, quelli che si stanno vivendo. */
export const QUANTI = 40;

let briciola = "fermo";
const blocchi: Blocco[] = [];

/** Lascia la briciola: «sto facendo X». Si chiama PRIMA di un lavoro che può
 *  essere lungo, e con `"fermo"` quando è finito. */
export function staFacendo(cosa: string) { briciola = cosa || "fermo"; }
/** Che cosa sta facendo adesso. */
export const cosaSta = (): string => briciola;

/** Registra un blocco. Torna true se è stato tenuto (sopra la soglia). */
export function segnaBlocco(ms: number, da: number, cosa = briciola): boolean {
  if (!Number.isFinite(ms) || ms < SOGLIA_MS) return false;
  blocchi.push({ ms: Math.round(ms), cosa: cosa || "fermo", da: Math.round(da) });
  if (blocchi.length > QUANTI) blocchi.splice(0, blocchi.length - QUANTI);
  return true;
}

export const bloccati = (): Blocco[] => blocchi.slice();

/** ── IL RIASSUNTO CHE SI LEGGE IN UNA RIGA ────────────────────────────────
 *  Quanti blocchi, il peggiore, e i tre reparti che ne hanno prodotti di più
 *  (per tempo totale, non per numero: dieci blocchi da mezzo secondo pesano
 *  come uno da cinque). */
export function riassunto(l: Blocco[] = blocchi): {
  quanti: number; peggiore: number; totale: number; reparti: { cosa: string; ms: number; n: number }[];
} {
  const per = new Map<string, { cosa: string; ms: number; n: number }>();
  let peggiore = 0, totale = 0;
  for (const b of l) {
    const ms = Number(b?.ms) || 0;
    totale += ms;
    if (ms > peggiore) peggiore = ms;
    const k = String(b?.cosa || "fermo");
    const v = per.get(k) || { cosa: k, ms: 0, n: 0 };
    v.ms += ms; v.n++;
    per.set(k, v);
  }
  return {
    quanti: l.length,
    peggiore,
    totale,
    reparti: [...per.values()].sort((a, b) => b.ms - a.ms).slice(0, 3),
  };
}

/** Una riga in italiano, per il pannello e per il registro. */
export function inParole(r = riassunto()): string {
  if (!r.quanti) return "nessun blocco sopra mezzo secondo";
  const q = r.reparti.map((x) => `${x.cosa} (${(x.ms / 1000).toFixed(1)}s in ${x.n})`).join(", ");
  return `${r.quanti} blocchi, il peggiore ${(r.peggiore / 1000).toFixed(1)}s — soprattutto: ${q}`;
}

/** ── VALE LA PENA MANDARLO AL SERVER? ─────────────────────────────────────
 *  Si manda solo quando c'è qualcosa da dire e non più di una volta al minuto:
 *  una diagnostica che chiacchiera è un altro pezzo di lentezza. */
export function daRaccontare(p: { quanti?: number; ultimoInvioMs?: number; adesso?: number }): boolean {
  if (!p.quanti) return false;
  const ultimo = Number(p.ultimoInvioMs) || 0;
  const adesso = Number(p.adesso) || 0;
  return !ultimo || adesso - ultimo >= 60_000;
}
