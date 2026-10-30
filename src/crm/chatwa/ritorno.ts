/** ── «DI RITORNO», DALLA CHAT ──────────────────────────────────────────────
 *  Richiesta del titolare (28/10/2026): nella chat WhatsApp si deve vedere se
 *  il lead è di ritorno (ricomparso in una lista: `data.ricarico`) e lo stato
 *  che aveva PRIMA (`ricarico.statoAllora`). Chi risponde in chat cambia tono:
 *  non ci si presenta da zero a chi aveva già un appuntamento.
 *  Tre misure della stessa cosa, perché lo spazio non è lo stesso:
 *   · `corta`    → la riga dell'elenco, stretta sul telefono: «Ritorno» (l'icona la mette chi disegna);
 *   · `completa` → l'intestazione della chat: «Di ritorno ×2 · prima: …»;
 *   · `titolo`   → tooltip e Info, con la data dell'ultimo ritorno.
 *  ⚠️ NON INVENTA: senza `statoAllora` (schede vecchie) o con uno stato che non
 *   esiste più non si scrive «prima: …», si dice solo che è di ritorno.
 *  La lettura del ricarico è quella dell'importazione (`ricaricoDi`): una sola,
 *  o la chat e «Lead importati» contano volte diverse. */
import { ricaricoDi } from "@/crm/importa/ricarico";
import { statoPrimaDelRitorno } from "@/crm/importa/ritorno-attesa";
import {
  LEAD_STATUS_LABEL,
  LOST_REASON_LABEL,
  type LeadData,
  type LeadStatus,
  type LostReason,
} from "@/crm/types";

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
  const prima =
    (r.statoAllora &&
      Object.hasOwn(LEAD_STATUS_LABEL, r.statoAllora) &&
      LEAD_STATUS_LABEL[r.statoAllora]) ||
    null;
  const giorno = giornoRoma(r.ultimo);
  const completa = [`Di ritorno${volte > 1 ? ` ×${volte}` : ""}`, prima && `prima: ${prima}`]
    .filter(Boolean)
    .join(" · ");
  const titolo = [
    volte > 1 ? `Ricomparso ${volte} volte in una lista` : "Ricomparso in una lista",
    giorno && `l'ultima il ${giorno}`,
    prima && `prima era: ${prima}`,
  ]
    .filter(Boolean)
    .join(" · ");
  return { volte, prima, corta: "Ritorno", completa, titolo };
}

/** «prima: …» sotto lo stato (30/10/2026): l'etichetta del CRM dello stato che
 *  aveva prima che il ritorno lo spostasse in «Attesa WhatsApp». `null` = non
 *  di ritorno, non spostato, o stato già cambiato a mano (`statoPrimaDelRitorno`). */
export function primaDelRitorno(d?: Partial<LeadData> | null): string | null {
  const s = statoPrimaDelRitorno(d);
  return (s && Object.hasOwn(LEAD_STATUS_LABEL, s) && LEAD_STATUS_LABEL[s]) || null;
}

/* ── IL RIQUADRO DEL RITORNO (30/10/2026) ──────────────────────────────────
 *  Richiesta del titolare: toccando l'icona del ritorno si vede lo stato di
 *  prima, cosa aveva fatto e le note, senza aprire la scheda. Solo campi già
 *  nella scheda; quelli vuoti non compaiono. */
export interface VoceRitorno {
  etichetta: string;
  valore: string;
  /** testo lungo (note): va a capo e scorre */
  lungo?: boolean;
}

const pulito = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export function vociRitorno(
  d?: Partial<LeadData> | null,
  consulente?: string | null,
): VoceRitorno[] {
  const r = ritornoInChat(d);
  if (!r || !d) return [];
  const ric = ricaricoDi(d);
  const voci: VoceRitorno[] = [];
  voci.push({ etichetta: "Stato di prima", valore: r.prima ?? "non si sa (scheda vecchia)" });
  const giorno = giornoRoma(ric?.ultimo);
  voci.push({
    etichetta: "Ricomparso",
    valore: [
      r.volte > 1 ? `${r.volte} volte` : "1 volta",
      giorno && `l'ultima il ${giorno}`,
      pulito(ric?.lista) && `dalla lista «${pulito(ric?.lista)}»`,
    ]
      .filter(Boolean)
      .join(" · "),
  });
  if (d.stato && Object.hasOwn(LEAD_STATUS_LABEL, d.stato))
    voci.push({ etichetta: "Stato adesso", valore: LEAD_STATUS_LABEL[d.stato as LeadStatus] });
  const dm = pulito(d.dataMeeting);
  if (/^\d{4}-\d{2}-\d{2}/.test(dm))
    voci.push({
      etichetta: "Consulenza",
      valore: `${giornoRoma(`${dm.slice(0, 10)}T12:00:00Z`)}${pulito(d.oraMeeting) ? ` alle ${pulito(d.oraMeeting)}` : ""}`,
    });
  if (pulito(consulente)) voci.push({ etichetta: "Consulente", valore: pulito(consulente) });
  if (d.lostReason && Object.hasOwn(LOST_REASON_LABEL, d.lostReason))
    voci.push({
      etichetta: "Motivo perso",
      valore: [LOST_REASON_LABEL[d.lostReason as LostReason], pulito(d.lostReasonNote)]
        .filter(Boolean)
        .join(" · "),
    });
  if (pulito(d.note)) voci.push({ etichetta: "Note", valore: pulito(d.note), lungo: true });
  if (pulito(d.notePostCall))
    voci.push({
      etichetta: "Note dopo la consulenza",
      valore: pulito(d.notePostCall),
      lungo: true,
    });
  return voci;
}
