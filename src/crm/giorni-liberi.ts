/** ── UN GIORNO DELLA SQUADRA, CON LA DURATA E IL PASSO DATI ─────────────────
 *
 *  Il ciclo che stava dentro `useGiorniLiberi` (crm/useGiorniLiberi), spostato
 *  qui senza cambiarlo per poterlo provare senza browser (prove/idee/
 *  orari-durata.mjs, calendari finti e motore vero).
 *
 *  Commessa 2026-10-30 (richiesta del titolare): «Proponi orari» nella chat
 *  sceglie la DURATA (predefinita 45 minuti) e parte ogni quarto d'ora, solo su ore vuote; Slot liberi
 *  resta com'era (60 minuti, un orario ogni 60).
 *  ⚠️ PERCHÉ IL PASSO È UNA COSA A PARTE. Slot liberi conta POSTI: orari che si
 *   accavallano (9:00 e 9:30 di un'ora) sarebbero lo stesso consulente contato
 *   due volte, quindi lì il passo è la durata. Chi PROPONE un orario invece
 *   vuole ogni inizio possibile: col passo uguale alla durata un impegno alle
 *   10:15 toglieva 10:00 e 11:00 e le 11:30, libere sul calendario, non
 *   comparivano mai (prove: «impegno a metà fascia»).
 *  ⚠️ LIBERA PER TUTTA LA DURATA: lo dice `slotDelGiorno`, che controlla
 *   l'intervallo [inizio, inizio + durata) contro impegni, pause,
 *   indisponibilità e ore tenute; le chiusure dello studio con la stessa
 *   durata (`soloSlotAperti`).
 *  ───────────────────────────────────────────────────────────────────────── */
import { soloSlotAperti } from "@/crm/blocchi";
import { slotDelGiorno } from "@/crm/booking-utils";
import type { ModoFascia } from "@/crm/fascia-consulenza";
import { riassumiGiorno, type GiornoLibero } from "@/crm/slot-liberi";
import type { Consultant, Lead } from "@/crm/types";

export function giornoDellaSquadra(p: {
  /** AAAA-MM-GG */
  data: string;
  /** chi fa consulenze (già filtrati: attivi, con una settimana) */
  persone: Consultant[];
  leads: Lead[];
  /** le ore tenute per una persona sola di QUESTO giorno, «HH:MM» → modo */
  modi?: Map<string, ModoFascia>;
  /** minuti che l'orario deve restare libero */
  durata: number;
  /** ogni quanti minuti parte un orario; assente = la durata */
  passo?: number;
  /** oggi: minuti dalla mezzanotte prima dei quali non si offre niente */
  dopo?: number;
  /** solo le ore senza NESSUNO dentro (niente «insieme»): «Proponi orari» */
  soloLibere?: boolean;
}): GiornoLibero {
  const persone = p.persone.map((c) => {
    let slot: ReturnType<typeof slotDelGiorno> = [];
    try {
      slot = slotDelGiorno(c, p.data, p.durata, p.leads, undefined, undefined, p.modi, p.passo);
      //  ⚠️ PROPONI ORARI: UNA CONSULENZA FISSATA OCCUPA LA SUA FASCIA (30/10/2026).
      //   «Insieme» (stesso inizio, fino a 3) vale per Slot liberi e i gruppi; nella
      //   chat proponeva al cliente l'inizio di una consulenza già fissata
      //   (segnalazione del titolare: 13:30, 15:00, 16:30, 18:00 tutte prese).
      if (p.soloLibere) slot = slot.filter((s) => s.stato === "libero");
      //  Le chiusure dello studio (Orari disponibili): `slotDelGiorno` non le guarda.
      slot = soloSlotAperti(slot, c.id, p.data, p.durata);
    } catch {
      /* un consulente con orari illeggibili non ferma la pagina */
    }
    return { id: c.id, nome: c.data.nome || "Senza nome", slot };
  });
  return riassumiGiorno({ data: p.data, persone, dopo: p.dopo });
}
