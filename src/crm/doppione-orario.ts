/** ── L'ORARIO SCELTO VA SULLA SCHEDA CHE C'È GIÀ ────────────────────────────
 *
 *  Richiesta del committente: «se aggiungo un lead che è già presente nel CRM,
 *  mi si apre il popup e mi porta su quel lead, dove posso vedere la sua scheda
 *  e posso riprogrammare la consulenza, o se sta su lead importati
 *  semplicemente la schedulo».
 *
 *  Il nuovo lead parte dall'ORARIO (passo 1), e il numero si scrive dopo
 *  (passo 2): quando il popup dice «ce l'abbiamo già» lo slot è già scelto.
 *  Prima la scheda vecchia si apriva vuota di quell'orario, e bisognava
 *  ricordarselo e rifarlo a mano con «Sposta». Qui l'orario passa sulla scheda
 *  vecchia: un lead importato si ritrova fissato, uno con la consulenza la
 *  ritrova spostata.
 *
 *  ⚠️ NON SI SALVA DA SOLO: la scheda si apre con l'orario nuovo dentro e chi
 *   la guarda preme Salva. Su una scheda vecchia può esserci un appuntamento
 *   vero, e cambiarlo senza che nessuno l'abbia visto è peggio del doppione.
 *  ───────────────────────────────────────────────────────────────────────── */
import type { LeadData, LeadStatus } from "./types";
import { STATI_VINTI } from "./types";

/*  Una data nuova sulla consulenza NON deve cambiare questi stati: la
 *  consulenza è già stata fatta, il lead è già venduto, o la data è quella
 *  della visita in sede. Tutti gli altri tornano «Appuntamento fissato». */
export const STATI_CHE_TENGONO_LO_STATO = new Set<LeadStatus>([
  "fatto",
  ...STATI_VINTI,
  "viene_in_sede",
]);

export interface OrarioScelto {
  consulenteId: string;
  dataMeeting: string;
  oraMeeting: string;
  durataMeeting?: number;
}

/** L'orario scelto nel nuovo lead, se è completo (consulente, giorno, ora). */
export function orarioScelto(f?: Partial<LeadData> | null): OrarioScelto | null {
  const consulenteId = String(f?.consulenteId ?? "").trim();
  const dataMeeting = String(f?.dataMeeting ?? "").trim();
  const oraMeeting = String(f?.oraMeeting ?? "").trim();
  if (!consulenteId || !dataMeeting || !oraMeeting) return null;
  const durata = Number(f?.durataMeeting) || undefined;
  return { consulenteId, dataMeeting, oraMeeting, ...(durata ? { durataMeeting: durata } : {}) };
}

/** La scheda vecchia con l'orario nuovo. Il resto non si tocca. */
export function conOrario(d: LeadData, o: OrarioScelto): LeadData {
  return {
    ...d,
    consulenteId: o.consulenteId,
    dataMeeting: o.dataMeeting,
    oraMeeting: o.oraMeeting,
    durataMeeting: o.durataMeeting ?? d.durataMeeting,
    stato: STATI_CHE_TENGONO_LO_STATO.has(d.stato) ? d.stato : "appuntamento_fissato",
  };
}

/** Che cosa succede, detto prima: «fissa» se non aveva una consulenza, «sposta» se sì. */
export function cosaFaLOrario(d?: Partial<LeadData> | null): "fissa" | "sposta" {
  return d?.dataMeeting && d?.oraMeeting ? "sposta" : "fissa";
}
