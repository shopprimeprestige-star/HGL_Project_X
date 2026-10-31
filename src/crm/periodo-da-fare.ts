/** ── LE DATE DI «DA FARE» NEL PANNELLO «OGGI» (31/10/2026) ───────────────────
 *  Richiesta del titolare: in «Da fare» le pastiglie come nelle chat, con «Oggi», «Ieri», una
 *  data sola, oppure da una data a un'altra. Qui solo le regole, senza disegno e senza rete.
 *
 *  ⚠️ DI SERIE È OGGI, e una scelta fatta in un altro giorno NON si ricorda: la sera si guarda
 *   «Ieri», la mattina dopo «Ieri» sarebbe l'altro ieri e chi apre la chat crederebbe di
 *   vedere la giornata di oggi. La scelta si salva insieme al giorno in cui è stata fatta
 *   (`scriviPeriodo`) e si rilegge solo se è lo stesso (`leggiPeriodo`).
 *  ⚠️ UNA DATA CHE MANCA O NON ESISTE NON SVUOTA L'ELENCO: vale oggi. Un elenco vuoto per una
 *   casella ancora da compilare direbbe «non hai niente da fare», che è peggio che mostrare oggi.
 *  Date locali "AAAA-MM-GG", mai UTC (vedi dafare/quando.ts). */
import { dataPulita } from "@/crm/dafare/quando";
import { oggiIso } from "@/crm/ui";

/** «tutti» (titolare, 31/10): ogni cosa ancora da gestire, di qualsiasi data, anche di mesi fa. */
export type TipoPeriodo = "oggi" | "ieri" | "giorno" | "intervallo" | "tutti";

export interface Periodo {
  tipo: TipoPeriodo;
  /** Giorno ISO: la data sola per «giorno», l'inizio per «intervallo». Vuoto negli altri. */
  da: string;
  /** Giorno ISO: la fine per «intervallo». Vuoto negli altri. */
  a: string;
}

export const PERIODO_DI_SERIE: Periodo = { tipo: "oggi", da: "", a: "" };

const TIPI: TipoPeriodo[] = ["oggi", "ieri", "giorno", "intervallo", "tutti"];

/** Il giorno prima di `iso` (mezzogiorno, non mezzanotte: vedi dafare/quando.ts). */
export function giornoPrima(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() - 1);
  return oggiIso(d);
}

/** Dal primo all'ultimo giorno compresi, già ripuliti e in ordine. */
export function intervalloDi(p: Periodo, oggi: string): { da: string; a: string } {
  if (p.tipo === "ieri") {
    const ieri = giornoPrima(oggi);
    return { da: ieri, a: ieri };
  }
  const da = dataPulita(p.da);
  const a = dataPulita(p.a);
  if (p.tipo === "giorno") return { da: da || oggi, a: da || oggi };
  if (p.tipo === "intervallo") {
    const primo = da || a || oggi;
    const ultimo = a || da || oggi;
    return primo <= ultimo ? { da: primo, a: ultimo } : { da: ultimo, a: primo };
  }
  return { da: oggi, a: oggi };
}

/** Il testo da mettere nel localStorage. */
export function scriviPeriodo(p: Periodo, oggi: string): string {
  return JSON.stringify({ tipo: p.tipo, da: p.da, a: p.a, giorno: oggi });
}

/** La scelta salvata, o quella di serie se non c'è, è di un altro giorno o non si legge. */
export function leggiPeriodo(raw: string | null, oggi: string): Periodo {
  try {
    const v = JSON.parse(raw ?? "null") as Record<string, unknown> | null;
    if (!v || typeof v !== "object" || v.giorno !== oggi) return PERIODO_DI_SERIE;
    if (!TIPI.includes(v.tipo as TipoPeriodo)) return PERIODO_DI_SERIE;
    return { tipo: v.tipo as TipoPeriodo, da: dataPulita(v.da), a: dataPulita(v.a) };
  } catch {
    return PERIODO_DI_SERIE;
  }
}
