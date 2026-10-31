/** ── LE REGOLE DEL PANNELLO «OGGI» NELLA CHAT ──────────────────────────────
 *  Commessa 2026-10-30, parte A. Nessuna regola nuova: le cose da fare sono le
 *  righe di «Da fare oggi» (crm/dafare/righe) con i filtri con cui quella
 *  pagina si apre — senza l'arretrato dei lead, senza i giorni futuri — e il
 *  filtro consulente è lo stesso `rigaPassaChi`. Le righe già spuntate qui non
 *  si mostrano: la colonna è stretta, e la barrata resta visibile nella pagina. */
import { FASCE, fasciaDi, ordinaRighe, type Fascia, type RigaDaFare } from "@/crm/dafare/righe";
import { rigaPassaChi, type MappaMestieri } from "@/crm/dafare/di-chi";
import { stessoNumero } from "@/crm/telefono-doppio";
import { giornoPrima, intervalloDi, type Periodo } from "@/crm/periodo-da-fare";

/** Le fasce che «Da fare oggi» mostra all'apertura (vedi `passaMomento`). */
export const FASCE_DEL_PANNELLO: Fascia[] = FASCE.filter(
  (f) => f !== "arretrato" && f !== "piuAvanti",
);

export interface GruppoPannello {
  /** Una fascia della giornata, oppure «giorno:AAAA-MM-GG» quando si guarda un'altra data. */
  fascia: Fascia | `giorno:${string}`;
  /** Solo per i gruppi-giorno: «Ieri · giovedì 30 ottobre». */
  titolo?: string;
  righe: RigaDaFare[];
}

/** «Ieri · giovedì 30 ottobre», «Oggi · …», «Domani · …»; per gli altri giorni solo la data. */
export function titoloDelGiorno(giorno: string, oggi: string): string {
  const lungo = new Date(`${giorno}T12:00:00`).toLocaleDateString("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  if (giorno === oggi) return `Oggi · ${lungo}`;
  if (giorno === giornoPrima(oggi)) return `Ieri · ${lungo}`;
  if (giornoPrima(giorno) === oggi) return `Domani · ${lungo}`;
  return lungo;
}

export function daFareDelPannello({
  righe,
  adesso,
  oggi,
  chi,
  mestieri,
  ordinaArretrati,
  periodo,
}: {
  /** Le date: senza (o «oggi») la giornata con il suo «Rimasto indietro», com'era; con un'altra
   *  scelta, un gruppo per ogni giorno compreso nelle date, spuntate escluse. */
  periodo?: Periodo;
  righe: RigaDaFare[];
  adesso: number;
  oggi: string;
  chi: string;
  mestieri: MappaMestieri;
  /** il verso scelto da chi guarda per «Rimasto indietro» (crm/dafare/arretrati) */
  ordinaArretrati?: (r: RigaDaFare[]) => RigaDaFare[];
}): GruppoPannello[] {
  if (periodo && periodo.tipo !== "oggi" && periodo.tipo !== "tutti") {
    const { da, a } = intervalloDi(periodo, oggi);
    const perGiorno = new Map<string, RigaDaFare[]>();
    for (const r of righe) {
      if (r.fatta || !rigaPassaChi(r, chi, mestieri) || r.giorno < da || r.giorno > a) continue;
      perGiorno.set(r.giorno, [...(perGiorno.get(r.giorno) ?? []), r]);
    }
    return [...perGiorno.keys()].sort().map((g) => ({
      fascia: `giorno:${g}` as const,
      titolo: titoloDelGiorno(g, oggi),
      righe: ordinaRighe(perGiorno.get(g) ?? []),
    }));
  }
  //  «Tutti»: ogni fascia, anche l'arretrato dei lead di mesi fa e i prossimi giorni.
  const fasce = periodo?.tipo === "tutti" ? FASCE : FASCE_DEL_PANNELLO;
  const mappa = new Map<Fascia, RigaDaFare[]>();
  for (const r of righe) {
    if (r.fatta || !rigaPassaChi(r, chi, mestieri)) continue;
    const f = fasciaDi(r, adesso, oggi);
    if (!fasce.includes(f)) continue;
    mappa.set(f, [...(mappa.get(f) ?? []), r]);
  }
  return fasce.filter((f) => mappa.has(f)).map((f) => {
    const gruppo = mappa.get(f) ?? [];
    return {
      fascia: f,
      righe: f === "daIeri" && ordinaArretrati ? ordinaArretrati(gruppo) : ordinaRighe(gruppo),
    };
  });
}

export const contaRighe = (gruppi: GruppoPannello[]) =>
  gruppi.reduce((n, g) => n + g.righe.length, 0);

/** La chat già abbinata a questo lead (l'abbinamento lo fa useChatWa); se
 *  nessuna è abbinata, quella con lo stesso numero (titolare, 31/10: dal
 *  «Da fare» si apre la chat nel CRM, non la scheda). */
export function chatDelLead<T extends { phone: string; lead?: { id: string } | null }>(
  chats: T[],
  leadId: string,
  telefono?: string | null,
): T | null {
  if (!leadId) return null;
  return (
    chats.find((c) => c.lead?.id === leadId) ??
    (telefono ? chats.find((c) => stessoNumero(c.phone, telefono)) : undefined) ??
    null
  );
}
