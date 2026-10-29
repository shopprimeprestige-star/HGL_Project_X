/** ── CHI CHIAMARE ADESSO: UNA CLASSIFICA SOLA ──────────────────────────────
 *
 *  Commessa 2026-10-30 (idea 7): il consulente apre il CRM e trova, in un
 *  elenco solo, chi chiamare per primo. Prima le risposte erano in chat, i
 *  richiami in «Da fare oggi», i caldi e i da chiamare nella coda di «Lead
 *  importati» (solo per gli importati): quattro posti da ricomporre a mente.
 *
 *  ── L'ORDINE ──────────────────────────────────────────────────────────────
 *   1. HA RISPOSTO DA POCO  ha scritto su WhatsApp nelle ultime 24 ore: la
 *                           palla è nostra, e fra un'ora non se lo ricorda più
 *   2. RICHIAMO SCADUTO     una promessa nostra, il giorno è arrivato
 *   3. CALDO                da chiamare, con la temperatura calda
 *   4. DA CHIAMARE          tutti gli altri da telefonare oggi
 *  Dentro «ha risposto» va prima la risposta più recente; negli altri tre
 *  l'ordine è quello della coda (`ordinaChiamate`): stesse regole, nessuna
 *  seconda idea di «chi prima».
 *
 *  ⚠️ NIENTE REGOLE NUOVE DOVE CE N'ERA GIÀ UNA. «Da telefonare oggi» è
 *   `daTelefonareOggi`, la promessa scaduta è il motivo «promessa» di
 *   `motivoChiamata`, il caldo è `temperaturaDi` (lo stesso termometro della
 *   scheda), la risposta è il secondo stato `contattoWa` («Ha risposto»).
 *  ⚠️ UNA SCHEDA UNITA IN UN'ALTRA NON C'È (`eAssorbita`): la persona è una
 *   sola, e chiamarla due volte perché ha due schede è il danno dei doppioni.
 *  ⚠️ CHI HA COMPRATO NON SI CHIAMA da qui anche se ha scritto: la sua chat la
 *   segue chi fa la posa, non la coda delle telefonate.
 *  ⚠️ LE ORE SONO QUELLE DELL'OROLOGIO DI CHI GUARDA (come la coda). Sul
 *   server (riepilogo del mattino, UTC) il giorno coincide con Roma fino alle
 *   22: il cron gira la mattina.
 *  ───────────────────────────────────────────────────────────────────────── */
import { STATI_VINTI, eAppuntamento, type Lead, type LeadData } from "@/crm/types";
import { eAssorbita } from "@/crm/doppioni";
import { eLivelloCaldo, temperaturaDi } from "@/crm/temperatura-lead";
import { motivoChiamata, ordinaChiamate } from "@/crm/importa/chi-chiamare";
import { daTelefonareOggi } from "@/crm/importa/da-telefonare";
import { eSaltato } from "@/crm/importa/saltati";

export type MotivoAdesso = "risposto" | "richiamo" | "caldo" | "daChiamare";

export const NOME_MOTIVO_ADESSO: Record<MotivoAdesso, string> = {
  risposto: "HA RISPOSTO",
  richiamo: "RICHIAMO SCADUTO",
  caldo: "CALDO",
  daChiamare: "DA CHIAMARE",
};

const RANGO: Record<MotivoAdesso, number> = { risposto: 0, richiamo: 1, caldo: 2, daChiamare: 3 };

/** Quanto resta «da poco» una risposta su WhatsApp. */
export const ORE_RISPOSTO_DA_POCO = 24;
/** Un orologio un po' avanti non deve far sparire una risposta appena arrivata. */
const SCARTO_OROLOGI_MS = 5 * 60_000;

/** Le pratiche finite: non si chiamano, qualunque cosa scrivano. */
const CHIUSI = new Set<string>([...STATI_VINTI, "concluso", "annullato", "perdi_tempo", "non_interessato"]);

type LeadMinimo = { id: string; data?: Partial<LeadData> | null };

export interface VoceAdesso<L extends LeadMinimo = Lead> {
  lead: L;
  motivo: MotivoAdesso;
  /** Il perché in poche parole, da mettere sulla riga. */
  testo: string;
}

/** Da quanti millisecondi ha risposto su WhatsApp; `null` se non ha risposto
 *  da poco (o la data non si legge: «non so quando» non è «da poco»). */
function rispostoDa(d: Partial<LeadData>, adesso: Date): number | null {
  const c = d.contattoWa;
  if (c?.stato !== "ha_risposto") return null;
  const il = Date.parse(String(c.il ?? ""));
  if (Number.isNaN(il)) return null;
  const ms = adesso.getTime() - il;
  if (ms < -SCARTO_OROLOGI_MS || ms >= ORE_RISPOSTO_DA_POCO * 3_600_000) return null;
  return Math.max(0, ms);
}

function fa(ms: number): string {
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "adesso";
  if (min < 60) return `${min} min fa`;
  return `${Math.floor(min / 60)} h fa`;
}

/** Il motivo per chiamare adesso questa scheda; `null` = non va chiamata. */
export function voceAdesso<L extends LeadMinimo>(l: L, adesso: Date): VoceAdesso<L> | null {
  const d = l?.data;
  if (!d || eAssorbita(l as unknown as Lead) || eSaltato(l as unknown as Lead)) return null;
  if (CHIUSI.has(String(d.stato ?? ""))) return null;

  const risposta = rispostoDa(d, adesso);
  if (risposta !== null)
    return { lead: l, motivo: "risposto", testo: `ha risposto su WhatsApp ${fa(risposta)}` };

  if (eAppuntamento(d.stato) || !daTelefonareOggi(d, adesso)) return null;
  const m = motivoChiamata(l, adesso);
  if (m.motivo === "promessa") return { lead: l, motivo: "richiamo", testo: m.testo };
  const { t } = temperaturaDi(d);
  if (eLivelloCaldo(t.livello))
    return { lead: l, motivo: "caldo", testo: t.perche ? `${t.parola}: ${t.perche}` : t.parola };
  return { lead: l, motivo: "daChiamare", testo: m.testo };
}

/** La classifica intera, già in ordine.
 *  `consulenteId`: assente = tutti; stringa = solo le schede di quel
 *  consulente; stringa vuota = solo quelle senza consulente. */
export function classificaAdesso<L extends LeadMinimo>(
  leads: (L | null | undefined)[] | null | undefined,
  adesso: Date,
  consulenteId?: string | null,
): VoceAdesso<L>[] {
  const voci: VoceAdesso<L>[] = [];
  for (const l of leads ?? []) {
    if (!l?.data) continue;
    if (consulenteId != null && String(l.data.consulenteId ?? "") !== consulenteId) continue;
    const v = voceAdesso(l, adesso);
    if (v) voci.push(v);
  }
  //  L'ordine della coda, calcolato una volta sola su chi non ha risposto.
  const posto = new Map<string, number>();
  ordinaChiamate(
    voci.filter((v) => v.motivo !== "risposto").map((v) => v.lead),
    adesso,
  ).forEach((l, i) => posto.set(l.id, i));
  const quando = (v: VoceAdesso<L>) => rispostoDa(v.lead.data ?? {}, adesso) ?? 0;
  return voci.sort(
    (a, b) =>
      RANGO[a.motivo] - RANGO[b.motivo] ||
      (a.motivo === "risposto"
        ? quando(a) - quando(b)
        : (posto.get(a.lead.id) ?? 0) - (posto.get(b.lead.id) ?? 0)),
  );
}
