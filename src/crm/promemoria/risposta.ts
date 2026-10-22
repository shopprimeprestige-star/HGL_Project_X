/** ── CHE COSA HA RISPOSTO IL CLIENTE AL «RISPONDA SÌ» ───────────────────────
 *
 *  Commessa 2026-10-22. Il webhook di WhatsApp riceve la risposta e chiede
 *  qui tre cose: che cosa vuol dire, a quale scheda va, e che cosa scrivere.
 *
 *  ⚠️ PRUDENTE PER SCELTA. Un falso «confermato» è peggio di una telefonata
 *   in più: «ok ma alle 16?» NON è un sì, va alla setter. Un falso STOP
 *   («basta» dentro una frase lunga) ferma i messaggi a quel numero: è il lato
 *   prudente, accettato.
 *  ⚠️ UN «GRAZIE» DOPO IL SÌ NON TOGLIE LA CONFERMA (correzione 4 del
 *   revisore): dopo il sì la gente scrive «grazie», «a domani». Lo toglie solo
 *   una risposta con dentro una negazione o uno spostamento («dubbio»).
 *  ───────────────────────────────────────────────────────────────────────── */
import type { LeadData, PromemoriaWhatsapp } from "../types";
import { chiaveAppuntamento } from "./invio";
import { minutiAlla, numeroPerWhatsapp, oraNormale } from "./formati";

export type Risposta = "si" | "stop" | "dubbio" | "altro";

const PAROLE_SI = ["si", "ok", "okay", "confermo", "confermato", "certo", "perfetto", "yes"];
//  ⚠️ Scritte NORMALIZZATE (senza accenti): «però» diventa «pero».
const PAROLE_DUBBIO = [
  "no",
  "non",
  "ma",
  "pero",
  "purtroppo",
  "annullo",
  "annulla",
  "disdico",
  "disdire",
  "sposta",
  "spostare",
  "spostiamo",
  "cambiare",
  "impossibile",
];
const PAROLE_STOP = ["stop", "basta"];
const MAX_PAROLE_SI = 6;

export function leggiRisposta(testo?: string | null): Risposta {
  const grezzo = String(testo ?? "");
  const parole = grezzo
    .replace(/👍|✅/gu, " ok ")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  if (parole.some((p) => PAROLE_STOP.includes(p))) return "stop";
  if (grezzo.includes("?") || parole.some((p) => PAROLE_DUBBIO.includes(p))) return "dubbio";
  const eSi = PAROLE_SI.includes(parole[0] ?? "") || (parole[0] === "va" && parole[1] === "bene");
  return eSi && parole.length <= MAX_PAROLE_SI ? "si" : "altro";
}

/** Le schede che possono ricevere una risposta: il messaggio è partito
 *  (anche «incerto»: una risposta prova che è arrivato). */
export const STATI_CON_MESSAGGIO = ["inviato", "incerto"] as const;

/** La scheda a cui va la risposta: quella col messaggio per l'appuntamento di
 *  adesso, stesso numero, appuntamento futuro, la più vicina. NON
 *  `autoLinkLead`, che prende il primo omonimo anche vecchio. */
export function schedaDellaRisposta<T extends { id: string; data?: Partial<LeadData> | null }>(
  schede: T[],
  numero: string,
  adesso: Date,
): T | null {
  const chi = numeroPerWhatsapp(numero);
  if (!chi) return null;
  let migliore: { s: T; mancano: number } | null = null;
  for (const s of schede) {
    const d = s.data ?? {};
    const p = d.promemoria;
    if (!p || !(STATI_CON_MESSAGGIO as readonly string[]).includes(String(p.stato))) continue;
    //  Spostato dopo il messaggio: il sì era per l'orario vecchio.
    if (p.chiave !== chiaveAppuntamento(d)) continue;
    if (numeroPerWhatsapp(d.telefono) !== chi) continue;
    const ora = oraNormale(d.oraMeeting);
    if (!ora || !d.dataMeeting) continue;
    const mancano = minutiAlla(d.dataMeeting, ora, adesso);
    if (mancano <= 0) continue;
    if (!migliore || mancano < migliore.mancano) migliore = { s, mancano };
  }
  return migliore?.s ?? null;
}

const tempo = (x?: string | null) => (x ? Date.parse(x) : -Infinity);

/** Il pezzo da fondere in `data.promemoria` per questa risposta; `null` =
 *  non si scrive niente. Il testo del cliente si tiene breve (80 caratteri)
 *  e si mostra come testo semplice, mai come HTML. */
export function effettoRisposta(
  r: Risposta,
  testo: string | null | undefined,
  p: Partial<PromemoriaWhatsapp>,
  adessoIso: string,
): Partial<PromemoriaWhatsapp> | null {
  if (r === "si") return { confermatoIl: adessoIso, confermatoVia: "whatsapp" };
  if (r === "stop") return { stopIl: adessoIso };
  const confermatoPerUltimo = !!p.confermatoIl && tempo(p.confermatoIl) > tempo(p.rispostaIl);
  if (r === "altro" && confermatoPerUltimo) return null;
  const breve = String(testo ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return { rispostaIl: adessoIso, rispostaTesto: breve };
}
