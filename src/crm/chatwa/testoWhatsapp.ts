/** ── IL MESSAGGIO GIÀ SCRITTO NEL LINK DI WHATSAPP ───────────────────────────
 *  Idea 8 approvata dal titolare (30/10/2026). A finestra chiusa il bollino
 *  della riga e il tasto dell'intestazione aprono l'app WhatsApp sul numero:
 *  per gli appuntamenti fissati o rifissati ora ci arriva anche il promemoria
 *  giusto, già nella casella, da mandare con un tocco.
 *   - consulenza oggi → «Promemoria della mattina» (promemoria_oggi);
 *   - consulenza oggi, link nella scheda e meno di 35 minuti → «Link poco
 *     prima» (link_fra_poco);
 *   - consulenza domani → «Promemoria del giorno prima» (promemoria_domani);
 *   - ogni altro caso, ogni altro stato: nessun testo, solo il numero.
 *  I testi sono le risposte rapide predefinite, riempite come fa la casella.
 *  ⚠️ SE NEL TESTO RESTA UN SEGNAPOSTO ({link}, {ora}…) NON SI MANDA: il
 *   cliente non deve ricevere graffe. Meglio il solo numero.
 *  Puro, provato in prove/idee/righe.mjs.
 *  ───────────────────────────────────────────────────────────────────────── */
import { eAppuntamento, type LeadData } from "../types";
import { aRoma, minutiAlla, oraNormale } from "../promemoria/formati";
import { giornoPerMessaggio } from "../wa-orari";
import {
  RISPOSTE_PREDEFINITE,
  nomePerMessaggio,
  riempi,
  type RispostaRapida,
} from "./risposte-rapide";

/** «Entro 35 minuti» dalla consulenza il link va mandato subito. */
export const MINUTI_LINK_FRA_POCO = 35;
/** Un testo più lungo non entra in un link in modo affidabile: solo il numero. */
export const MAX_CARATTERI_TESTO = 1000;

/** Quale risposta rapida serve a questo lead adesso, o `null`. */
export function idPromemoria(
  dati: Partial<LeadData> | undefined | null,
  adesso: Date,
): string | null {
  if (!dati || !eAppuntamento(dati.stato)) return null;
  const giorno = String(dati.dataMeeting ?? "");
  const ora = oraNormale(dati.oraMeeting);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(giorno) || !ora) return null;
  const mancano = minutiAlla(giorno, ora, adesso);
  if (mancano <= 0) return null;
  const oggi = aRoma(adesso).giorno;
  if (giorno === oggi) {
    const conLink = String(dati.linkMeeting ?? "").trim() !== "";
    return conLink && mancano <= MINUTI_LINK_FRA_POCO ? "link_fra_poco" : "promemoria_oggi";
  }
  //  Domani = il giorno di calendario dopo (a Roma), non «fra 24 ore».
  return giorno === giornoDopo(oggi) ? "promemoria_domani" : null;
}

/** Il giorno di calendario dopo (`YYYY-MM-DD`). */
function giornoDopo(giorno: string): string {
  const d = new Date(`${giorno}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Il testo da precompilare nel link, o `""` (solo il numero). `consulente` è il nome
 *  del consulente della scheda; `risposte` di serie sono le predefinite. */
export function testoPerWhatsapp(
  chat: {
    lead?: { data: Partial<LeadData> } | null;
    contact?: { display_name?: string | null } | null;
  },
  consulente: string | null | undefined,
  adesso: Date,
  risposte: readonly RispostaRapida[] = RISPOSTE_PREDEFINITE,
): string {
  const dati = chat.lead?.data;
  const id = idPromemoria(dati, adesso);
  const modello = id ? risposte.find((r) => r.id === id) : undefined;
  if (!dati || !modello) return "";
  const testo = riempi(modello.testo, {
    nome: nomePerMessaggio(dati.nome, chat.contact?.display_name),
    consulente,
    giorno: giornoPerMessaggio(String(dati.dataMeeting), aRoma(adesso).giorno),
    ora: oraNormale(dati.oraMeeting),
    link: dati.linkMeeting,
  })
    //  Senza nome «{nome}, fra poco…» diventerebbe «, fra poco…» (revisione 30/10).
    .replace(/^[\s,]+/, "")
    .trim()
    .replace(/^\p{Ll}/u, (l) => l.toUpperCase());
  //  Un segnaposto rimasto ({link}, {ora_richiamo}, {indirizzo}…) o un testo troppo lungo: niente.
  if (/\{[^{}]*\}/.test(testo) || testo.length > MAX_CARATTERI_TESTO) return "";
  return testo;
}
