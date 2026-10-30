/** ── LE REGOLE DEL PANNELLO «OGGI» NELLA CHAT ──────────────────────────────
 *  Commessa 2026-10-30, parte A. Nessuna regola nuova: le cose da fare sono le
 *  righe di «Da fare oggi» (crm/dafare/righe) con i filtri con cui quella
 *  pagina si apre — senza l'arretrato dei lead, senza i giorni futuri — e il
 *  filtro consulente è lo stesso `rigaPassaChi`. Le righe già spuntate qui non
 *  si mostrano: la colonna è stretta, e la barrata resta visibile nella pagina. */
import { FASCE, fasciaDi, ordinaRighe, type Fascia, type RigaDaFare } from "@/crm/dafare/righe";
import { rigaPassaChi, type MappaMestieri } from "@/crm/dafare/di-chi";

/** Le fasce che «Da fare oggi» mostra all'apertura (vedi `passaMomento`). */
export const FASCE_DEL_PANNELLO: Fascia[] = FASCE.filter(
  (f) => f !== "arretrato" && f !== "piuAvanti",
);

export interface GruppoPannello {
  fascia: Fascia;
  righe: RigaDaFare[];
}

export function daFareDelPannello({
  righe,
  adesso,
  oggi,
  chi,
  mestieri,
  ordinaArretrati,
}: {
  righe: RigaDaFare[];
  adesso: number;
  oggi: string;
  chi: string;
  mestieri: MappaMestieri;
  /** il verso scelto da chi guarda per «Rimasto indietro» (crm/dafare/arretrati) */
  ordinaArretrati?: (r: RigaDaFare[]) => RigaDaFare[];
}): GruppoPannello[] {
  const mappa = new Map<Fascia, RigaDaFare[]>();
  for (const r of righe) {
    if (r.fatta || !rigaPassaChi(r, chi, mestieri)) continue;
    const f = fasciaDi(r, adesso, oggi);
    if (!FASCE_DEL_PANNELLO.includes(f)) continue;
    mappa.set(f, [...(mappa.get(f) ?? []), r]);
  }
  return FASCE_DEL_PANNELLO.filter((f) => mappa.has(f)).map((f) => {
    const gruppo = mappa.get(f) ?? [];
    return {
      fascia: f,
      righe: f === "daIeri" && ordinaArretrati ? ordinaArretrati(gruppo) : ordinaRighe(gruppo),
    };
  });
}

export const contaRighe = (gruppi: GruppoPannello[]) =>
  gruppi.reduce((n, g) => n + g.righe.length, 0);

/** La chat già abbinata a questo lead (l'abbinamento lo fa useChatWa). */
export function chatDelLead<T extends { lead?: { id: string } | null }>(
  chats: T[],
  leadId: string,
): T | null {
  if (!leadId) return null;
  return chats.find((c) => c.lead?.id === leadId) ?? null;
}
