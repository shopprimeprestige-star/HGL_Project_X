/** ── «DI RITORNO», DALLA CHAT ──────────────────────────────────────────────
 *  Richiesta del titolare (28/10/2026): nella chat WhatsApp si deve vedere se
 *  il lead è di ritorno (ricomparso in una lista: `data.ricarico`) e lo stato
 *  che aveva PRIMA (`ricarico.statoAllora`). Chi risponde in chat cambia tono:
 *  non ci si presenta da zero a chi aveva già un appuntamento.
 *  Tre misure della stessa cosa, perché lo spazio non è lo stesso:
 *   · `corta`    → la riga dell'elenco, stretta sul telefono: «↩ Ritorno»;
 *   · `completa` → l'intestazione della chat: «↩ Di ritorno ×2 · prima: …»;
 *   · `titolo`   → tooltip e Info, con la data dell'ultimo ritorno.
 *  ⚠️ NON INVENTA: senza `statoAllora` (schede vecchie) o con uno stato che non
 *   esiste più non si scrive «prima: …», si dice solo che è di ritorno.
 *  La lettura del ricarico è quella dell'importazione (`ricaricoDi`): una sola,
 *  o la chat e «Lead importati» contano volte diverse. */
import { ricaricoDi } from "@/crm/importa/ricarico";
import { LEAD_STATUS_LABEL, type LeadData } from "@/crm/types";

export interface RitornoChat {
  /** Quante volte è ricomparso in una lista (≥ 1). */
  volte: number;
  /** Lo stato che aveva quando è ricomparso, in chiaro. `null` = non si sa. */
  prima: string | null;
  corta: string;
  completa: string;
  titolo: string;
}

/** Il giorno a Roma («12/10/2026»), o "" se la data non si legge. */
function giornoRoma(iso?: string): string {
  const t = Date.parse(String(iso || ""));
  return Number.isFinite(t)
    ? new Date(t).toLocaleDateString("it-IT", {
        timeZone: "Europe/Rome",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "";
}

/** Il ritorno di questa scheda da mostrare in chat, o `null` se non è di ritorno. */
export function ritornoInChat(d?: Partial<LeadData> | null): RitornoChat | null {
  const r = ricaricoDi(d);
  if (!r) return null;
  const volte = r.volte;
  const prima = (r.statoAllora && LEAD_STATUS_LABEL[r.statoAllora]) || null;
  const giorno = giornoRoma(r.ultimo);
  const completa = [`↩ Di ritorno${volte > 1 ? ` ×${volte}` : ""}`, prima && `prima: ${prima}`]
    .filter(Boolean)
    .join(" · ");
  const titolo = [
    volte > 1 ? `Ricomparso ${volte} volte in una lista` : "Ricomparso in una lista",
    giorno && `l'ultima il ${giorno}`,
    prima && `prima era: ${prima}`,
  ]
    .filter(Boolean)
    .join(" · ");
  return { volte, prima, corta: "↩ Ritorno", completa, titolo };
}
