/** ── UN FILTRO PER OGNI STATO DEL LEAD, NELLA CHAT WHATSAPP (30/10/2026) ──────
 *
 *  Richiesta del titolare: «tutti i lead, esempio da riprogrammare oppure
 *  cliente assente, abbiano su WhatsApp un loro filtro, verso la fine».
 *  Le chat si filtrano per lo stato della scheda abbinata (la stessa che dà la
 *  pastiglia in RigaChat), con le etichette e l'ordine di `LEAD_STATUS_LABEL`.
 *
 *  · `attesa_whatsapp` e `da_chiamare` hanno già la loro pastiglia in cima:
 *    non si ripetono qui.
 *  · «Cliente assente» è l'etichetta di due valori (`no_show`, `non_fatto`):
 *    un filtro solo, che li prende entrambi.
 *  · Il filtro è `"per-stato"` (ogni chat con uno stato di questo gruppo) o
 *    `stato:<valore>` (uno solo). Stesso canale delle altre pastiglie
 *    (`FiltroChat`): vale per tutti i riquadri e si combina col consulente.
 *  Puro, provato in prove/manychat/chat-per-stato.mjs.
 *  ───────────────────────────────────────────────────────────────────────── */
import { LEAD_STATUS_LABEL, type LeadStatus } from "@/crm/types";

export const FILTRO_PER_STATO = "per-stato";
const PREFISSO = "stato:";
export type FiltroPerStato = typeof FILTRO_PER_STATO | `stato:${string}`;

/** Stati che hanno già una pastiglia tutta loro. */
const CON_PASTIGLIA: readonly string[] = ["attesa_whatsapp", "da_chiamare"];

/** Per ogni valore, quello «canonico» con la stessa etichetta (il primo dichiarato). */
const CANONICO: Record<string, LeadStatus> = (() => {
  const perEtichetta = new Map<string, LeadStatus>();
  const m: Record<string, LeadStatus> = {};
  for (const s of Object.keys(LEAD_STATUS_LABEL) as LeadStatus[]) {
    const e = LEAD_STATUS_LABEL[s];
    if (!perEtichetta.has(e)) perEtichetta.set(e, s);
    m[s] = perEtichetta.get(e)!;
  }
  return m;
})();

/** Gli stati che hanno un filtro per stato, nell'ordine del CRM, uno per etichetta. */
export const STATI_PER_STATO: readonly LeadStatus[] = (
  Object.keys(LEAD_STATUS_LABEL) as LeadStatus[]
).filter((s) => CANONICO[s] === s && !CON_PASTIGLIA.includes(s));

interface ChatConStato {
  lead?: { data?: { stato?: string | null } | null } | null;
}

/** Lo stato (canonico) della chat se ha un filtro per stato; `null` senza scheda o per stati fuori gruppo. */
export function statoPerFiltro(c: ChatConStato): LeadStatus | null {
  const s = String(c.lead?.data?.stato ?? "");
  const canonico = CANONICO[s];
  return canonico && STATI_PER_STATO.includes(canonico) ? canonico : null;
}

/** Il testo del filtro è uno dei due di questo gruppo? */
export function eFiltroPerStato(filtro: string): filtro is FiltroPerStato {
  return filtro === FILTRO_PER_STATO || filtro.startsWith(PREFISSO);
}

/** Il filtro di uno stato (sempre col valore canonico). */
export function filtroDelloStato(stato: string): FiltroPerStato {
  return `${PREFISSO}${CANONICO[stato] ?? stato}`;
}

/** La chat passa il filtro? Uno stato che non esiste non lascia passare niente. */
export function passaPerStato(c: ChatConStato, filtro: FiltroPerStato): boolean {
  const s = statoPerFiltro(c);
  if (s === null) return false;
  if (filtro === FILTRO_PER_STATO) return true;
  const voluto = CANONICO[filtro.slice(PREFISSO.length)];
  return voluto === s;
}

export interface VocePerStato {
  stato: LeadStatus;
  etichetta: string;
  n: number;
}

/** Le voci con almeno una chat (nell'ordine del CRM) e il totale. */
export function contaPerStato(chats: ChatConStato[]): { voci: VocePerStato[]; tutti: number } {
  const n = new Map<LeadStatus, number>();
  let tutti = 0;
  for (const c of chats) {
    const s = statoPerFiltro(c);
    if (!s) continue;
    n.set(s, (n.get(s) ?? 0) + 1);
    tutti++;
  }
  return {
    voci: STATI_PER_STATO.filter((s) => n.has(s)).map((s) => ({
      stato: s,
      etichetta: LEAD_STATUS_LABEL[s],
      n: n.get(s)!,
    })),
    tutti,
  };
}

/** Le voci della fila, con lo stato scelto anche se intanto non ha più chat (a zero):
 *  il filtro non resta mai acceso senza vedersi. */
export function vociConScelto(voci: VocePerStato[], filtro: string): VocePerStato[] {
  if (!filtro.startsWith(PREFISSO)) return voci;
  const scelto = CANONICO[filtro.slice(PREFISSO.length)];
  if (!scelto || !STATI_PER_STATO.includes(scelto) || voci.some((v) => v.stato === scelto))
    return voci;
  const con = { stato: scelto, etichetta: LEAD_STATUS_LABEL[scelto], n: 0 };
  return STATI_PER_STATO.flatMap((s) => (s === scelto ? [con] : voci.filter((v) => v.stato === s)));
}
