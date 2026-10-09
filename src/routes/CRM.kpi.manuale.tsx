/** ── /CRM/kpi/manuale — INDIRIZZO STORICO ──────────────────────────────────
 *
 *  «KPI manuale» non esiste più come scheda, e non è un taglio: era il difetto
 *  capitale di questa pagina. Mostrava gli stessi quattro numeri della
 *  panoramica — costo per lead, costo per cliente, ritorno sulla spesa, netto —
 *  calcolati però sulla sola spesa scritta a mano, mentre l'altra usava la sola
 *  spesa sincronizzata da Meta. Stesso periodo, due «costo per cliente»: chi
 *  cambiava linguetta vedeva il numero muoversi e concludeva che la pagina era
 *  rotta.
 *
 *  Delle due cose che quella scheda aveva davvero:
 *   · REGISTRARE LA SPESA A MANO è un gesto, non una sezione di analisi, e ora
 *     vive dentro la scheda «Ritorno», nel registro della spesa — dove la spesa
 *     scritta a mano confluisce con quella sincronizzata e con la stima TikTok,
 *     in un totale solo (src/crm/kpi/spesa.ts);
 *   · IL CONTO DEL NETTO era disegnato identico in due file, e adesso è uno
 *     solo: la sezione «Dove sono finiti i soldi» della scheda «Ritorno»
 *     (src/crm/kpi/conto-pezzi.tsx, `VoceConto`).
 *
 *  Il file resta, e resta una rotta, per un motivo solo: l'indirizzo è nei
 *  preferiti di chi registrava la spesa ogni sera ed è nella ricerca ⌘K (alias
 *  «kpi-manuale»). Un indirizzo che smette di funzionare non sembra spostato,
 *  sembra rotto.
 *
 *  `replace`: il reindirizzamento non deve restare nella cronologia, altrimenti
 *  il tasto indietro dalla scheda «Ritorno» ci ricasca dentro e rimbalza avanti
 *  di nuovo.
 *  ───────────────────────────────────────────────────────────────────────── */

import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/CRM/kpi/manuale")({
  beforeLoad: () => {
    throw redirect({ to: "/CRM/kpi", search: {}, replace: true });
  },
});
