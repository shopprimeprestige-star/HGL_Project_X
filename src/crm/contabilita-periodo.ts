/** ── IL CALENDARIO DEL COMMERCIALISTA ──────────────────────────────────────
 *
 *  ⚠️ QUI IL PERIODO NON È UNA FINESTRA MOBILE, ed è il motivo per cui questa
 *   sezione è uscita da KPI. Là «30 giorni» vuol dire «dalle 30×24 ore fa a
 *   adesso», ed è giusto: si guarda l'andamento della pubblicità, che non ha
 *   niente a che vedere col calendario.
 *   Qui invece si liquida l'IVA e si calcolano le imposte, e quelle si fanno
 *   per MESE, TRIMESTRE, ANNO — periodi con un primo e un ultimo giorno
 *   stabiliti dalla legge, non da quando si apre la pagina. Un'IVA calcolata
 *   «sugli ultimi trenta giorni» non corrisponde a nessuna dichiarazione
 *   esistente, e girata al commercialista gli fa perdere il pomeriggio.
 *  ───────────────────────────────────────────────────────────────────────── */

export type TipoPeriodo = "mese" | "trimestre" | "anno";

export interface Periodo {
  tipo: TipoPeriodo;
  /** primo giorno compreso, ISO */
  dal: string;
  /** ultimo giorno compreso, ISO */
  al: string;
  /** «settembre 2026», «3º trimestre 2026», «2026» */
  nome: string;
}

const MESI = [
  "gennaio",
  "febbraio",
  "marzo",
  "aprile",
  "maggio",
  "giugno",
  "luglio",
  "agosto",
  "settembre",
  "ottobre",
  "novembre",
  "dicembre",
];

const giorno = (a: number, m: number, g: number) =>
  `${a}-${String(m).padStart(2, "0")}-${String(g).padStart(2, "0")}`;
/** L'ultimo giorno di un mese, bisestili compresi: `new Date(a, m, 0)` dà il
 *  giorno zero del mese dopo, cioè l'ultimo di questo. */
const ultimoGiorno = (a: number, m: number) => new Date(a, m, 0).getDate();

export function costruisciPeriodo(tipo: TipoPeriodo, anno: number, indice: number): Periodo {
  if (tipo === "anno") {
    return { tipo, dal: giorno(anno, 1, 1), al: giorno(anno, 12, 31), nome: String(anno) };
  }
  if (tipo === "trimestre") {
    const primo = indice * 3 + 1;
    const ultimo = primo + 2;
    return {
      tipo,
      dal: giorno(anno, primo, 1),
      al: giorno(anno, ultimo, ultimoGiorno(anno, ultimo)),
      nome: `${indice + 1}º trimestre ${anno}`,
    };
  }
  const m = indice + 1;
  return {
    tipo,
    dal: giorno(anno, m, 1),
    al: giorno(anno, m, ultimoGiorno(anno, m)),
    nome: `${MESI[indice]} ${anno}`,
  };
}

/** Il periodo in cui cade oggi, del tipo chiesto. */
export function periodoCorrente(tipo: TipoPeriodo): Periodo {
  const o = new Date();
  const anno = o.getFullYear();
  const mese = o.getMonth();
  if (tipo === "anno") return costruisciPeriodo("anno", anno, 0);
  if (tipo === "trimestre") return costruisciPeriodo("trimestre", anno, Math.floor(mese / 3));
  return costruisciPeriodo("mese", anno, mese);
}

/** Il periodo prima o dopo. `passo` è −1 o +1. */
export function periodoVicino(p: Periodo, passo: number): Periodo {
  const anno = Number(p.dal.slice(0, 4));
  const mese = Number(p.dal.slice(5, 7)) - 1;
  if (p.tipo === "anno") return costruisciPeriodo("anno", anno + passo, 0);
  if (p.tipo === "trimestre") {
    const i = Math.floor(mese / 3) + passo;
    if (i < 0) return costruisciPeriodo("trimestre", anno - 1, 3);
    if (i > 3) return costruisciPeriodo("trimestre", anno + 1, 0);
    return costruisciPeriodo("trimestre", anno, i);
  }
  const i = mese + passo;
  if (i < 0) return costruisciPeriodo("mese", anno - 1, 11);
  if (i > 11) return costruisciPeriodo("mese", anno + 1, 0);
  return costruisciPeriodo("mese", anno, i);
}

/** Il filtro sulle date. ⚠️ Confronto fra stringhe e non fra oggetti Data: le
 *  date in archivio sono ISO a lunghezza fissa, quindi l'ordine alfabetico è
 *  l'ordine cronologico — e non ci sono fusi orari di mezzo a spostare un
 *  documento del primo del mese nel mese prima. */
export const dentroIlPeriodo =
  (p: Periodo) =>
  (data?: string | null): boolean => {
    const d = String(data ?? "").slice(0, 10);
    return d >= p.dal && d <= p.al;
  };

/** I mesi che il periodo tocca, per andare a prendere le spese fisse. */
export function mesiDelPeriodo(p: Periodo): string[] {
  const fuori: string[] = [];
  let a = Number(p.dal.slice(0, 4));
  let m = Number(p.dal.slice(5, 7));
  const fine = p.al.slice(0, 7);
  while (fuori.length < 24) {
    const mese = `${a}-${String(m).padStart(2, "0")}`;
    fuori.push(mese);
    if (mese >= fine) break;
    m += 1;
    if (m > 12) {
      m = 1;
      a += 1;
    }
  }
  return fuori;
}

/** true = il periodo non è ancora finito. Serve a dirlo: un trimestre in corso
 *  mostra numeri veri ma parziali, e chi li gira al commercialista come
 *  definitivi si accorge dopo che mancava un mese. */
export const inCorso = (p: Periodo): boolean => p.al >= new Date().toISOString().slice(0, 10);
