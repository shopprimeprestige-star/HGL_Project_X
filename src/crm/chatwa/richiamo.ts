/** ── QUANDO RICHIAMARLO, DALLA CHAT ─────────────────────────────────────────
 *  Richiesta del titolare (29/10/2026): «se cambio in Richiamo concordato non
 *  mi dà quando richiamarlo; devo avere il filtro di quando richiamarlo, oggi,
 *  domani ecc. con le date, da WhatsApp».
 *  La data la chiede già la finestra dello stato (QUANDO_PER_STATO →
 *  `dataRicontatto` / `oraRicontatto`): qui si legge e si mostra nella riga
 *  dell'elenco e nell'intestazione della chat («Richiamo oggi 15:00», rosso se
 *  è passato).
 *  ⚠️ VALE SOLO PER GLI STATI CHE QUELLA DATA LA CHIEDONO (richiamo, ci
 *   ricontatta lui, sta valutando…): una `dataRicontatto` rimasta da uno stato
 *   di prima non è un appuntamento, e mostrarla manderebbe a chiamare a vuoto.
 *  ⚠️ I GIORNI SONO STRINGHE «AAAA-MM-GG», come tutte le date del CRM: si
 *   confrontano come testo.
 *  ⚠️ 16/11/2026: tolto il filtro «Quando richiamare» (Scaduti/Oggi/Domani/una voce per data/Senza
 *   data) che stava dentro «Da chiamare»: era un secondo modo di chiedere «quando», con un secondo
 *   «Oggi» e un secondo «Scaduti» diversi da quelli della fila generica sotto ogni filtro (D2/D3
 *   dell'analisi). La fila generica (`giorno.ts`, `RigaGiorno`), estesa dal Compito 2 a leggere la
 *   stessa regola per «Da chiamare», fa lo stesso lavoro con un conteggio solo. Restano qui
 *   `richiamoDi`/`etichettaRichiamo`/`stileRichiamo`: servono ancora alla pastiglia della riga.
 *  Tutto puro, provato in prove/prove.mjs (proveDelRichiamoInChat).
 *  ───────────────────────────────────────────────────────────────────────── */
import { QUANDO_PER_STATO } from "@/crm/quando-per-stato";
import { giornoParlato, oraNormale } from "@/crm/promemoria/formati";
import type { LeadStatus } from "@/crm/types";

export interface Richiamo {
  /** AAAA-MM-GG */
  data: string;
  /** HH:MM, o `null` se l'ora non è stata messa (è facoltativa) */
  ora: string | null;
}

interface DatiConRichiamo {
  stato?: string | null;
  dataRicontatto?: string | null;
  oraRicontatto?: string | null;
}

/** Il richiamo fissato, o `null` se lo stato non ne prevede uno o la data manca. */
export function richiamoDi(d?: DatiConRichiamo | null): Richiamo | null {
  if (!d) return null;
  const regola = QUANDO_PER_STATO[String(d.stato ?? "") as LeadStatus];
  if (regola?.chiaveData !== "dataRicontatto") return null;
  const data = String(d.dataRicontatto ?? "").slice(0, 10);
  if (!giornoParlato(data)) return null;
  return { data, ora: oraNormale(d.oraRicontatto) };
}

const piu = (data: string, giorni: number): string => {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + giorni);
  return d.toISOString().slice(0, 10);
};

/** Il testo della pastiglia: «Richiamo oggi 15:00», «Richiamo domani»,
 *  «Richiamo ven 31 ott», «Richiamo scaduto 27 ott». `scaduto` = da fare subito. */
export function etichettaRichiamo(
  d: DatiConRichiamo | null | undefined,
  oggi: string,
): { testo: string; titolo: string; scaduto: boolean; oggi: boolean } | null {
  const r = richiamoDi(d);
  if (!r) return null;
  const intero = giornoParlato(r.data) ?? r.data;
  const [, gg, mese] = intero.split(" ");
  const breve = `${intero.slice(0, 3)} ${gg} ${String(mese ?? "").slice(0, 3)}`;
  const ora = r.ora ? ` ${r.ora}` : "";
  const scaduto = r.data < oggi;
  const quando =
    r.data === oggi
      ? "oggi"
      : r.data === piu(oggi, 1)
        ? "domani"
        : scaduto
          ? `scaduto ${gg} ${String(mese ?? "").slice(0, 3)}`
          : breve;
  return {
    testo: `Richiamo ${quando}${ora}`,
    titolo: `Da richiamare ${intero}${r.ora ? ` alle ${r.ora}` : " (ora non fissata)"}`,
    scaduto,
    oggi: r.data === oggi,
  };
}

/** I colori della pastiglia: rosso = scaduto, ambra = oggi, azzurro = più avanti. */
export function stileRichiamo(r: { scaduto: boolean; oggi: boolean }): string {
  return r.scaduto
    ? "border-red-300 bg-red-50 text-red-700"
    : r.oggi
      ? "border-amber-300 bg-amber-50 text-amber-800"
      : "border-sky-300 bg-sky-50 text-sky-800";
}
