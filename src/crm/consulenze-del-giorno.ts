/** ── LE CONSULENZE DI UN GIORNO ────────────────────────────────────────────
 *  Quali schede stanno nell'agenda di un giorno, e in che ordine. Era scritta
 *  dentro MeetGiornalieri; sta qui da quando la stessa giornata si guarda anche
 *  dal pannello «Oggi» della chat WhatsApp (commessa 2026-10-30): due copie
 *  della stessa scelta si scostano al primo ritocco, e il pannello direbbe
 *  un'altra giornata rispetto alla pagina.
 *  Ordine: per ora come stringa ("09:30" < "15:00"); le schede senza ora in
 *  cima, come l'agenda le ha sempre mostrate. */
import type { Lead } from "@/crm/types";

const soloGiorno = (v?: string | null) => (v ? String(v).slice(0, 10) : "");

export function consulenzeDelGiorno(
  leads: Lead[] | null | undefined,
  giorno: string,
  /** id del consulente; vuoto = tutti */
  chi = "",
): Lead[] {
  const tutti = Array.isArray(leads) ? leads : [];
  return tutti
    .filter(
      (l) => (!chi || l?.data?.consulenteId === chi) && soloGiorno(l?.data?.dataMeeting) === giorno,
    )
    .sort((a, b) => (a?.data?.oraMeeting || "").localeCompare(b?.data?.oraMeeting || ""));
}
