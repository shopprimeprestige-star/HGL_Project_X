/** ── PERCHÉ È PARTITO UN MODELLO (30/10/2026) ───────────────────────────────
 *
 *  Richiesta del titolare: capire a colpo d'occhio se un modello (a pagamento)
 *  serviva davvero. Sotto un nostro messaggio partito come modello la chat dice
 *  com'era la finestra di 24 ore in quel momento: chiusa (e da quando il cliente
 *  non scriveva) oppure aperta (allora poteva partire come testo).
 *  Si contano solo i messaggi del cliente arrivati dal canale (non le righe del
 *  ponte, `eRigaPonte`), come fa `finestra24` per la casella.
 *  Pure: prove in prove/idee/perche-modello.mjs.
 *  ───────────────────────────────────────────────────────────────────────── */
import { eRigaPonte } from "./stato";

type Riga = { id: string; direction: string; created_at: string; canale?: string | null };

const GIORNO_MS = 86_400_000;

/** Per ogni nostro messaggio, l'ultima entrata del cliente prima di lui (ISO) o `null`. */
export function entratePrima(messaggi: readonly Riga[]): Map<string, string | null> {
  const ordinati = [...messaggi].sort(
    (a, b) => Date.parse(a.created_at) - Date.parse(b.created_at),
  );
  const out = new Map<string, string | null>();
  let ultima: string | null = null;
  for (const m of ordinati) {
    if (m.direction === "inbound") {
      if (!eRigaPonte(m)) ultima = m.created_at;
    } else out.set(m.id, ultima);
  }
  return out;
}

const quando = (iso: string) =>
  new Date(iso).toLocaleString("it-IT", {
    timeZone: "Europe/Rome",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

/** La frase sotto il modello. `undefined` (non si sa) = nessuna frase. */
export function percheModello(
  inviatoIl: string,
  ultimaEntrata: string | null | undefined,
): { aperta: boolean; frase: string } | null {
  if (ultimaEntrata === undefined) return null;
  const t = Date.parse(inviatoIl);
  if (!Number.isFinite(t)) return null;
  if (ultimaEntrata === null)
    return { aperta: false, frase: "finestra chiusa: il cliente non aveva ancora scritto" };
  const e = Date.parse(ultimaEntrata);
  if (!Number.isFinite(e)) return null;
  if (t - e < GIORNO_MS)
    return { aperta: true, frase: "finestra aperta: poteva partire come testo" };
  return {
    aperta: false,
    frase: `finestra chiusa: ultimo messaggio del cliente ${quando(ultimaEntrata).replace(", ", " alle ")}`,
  };
}
