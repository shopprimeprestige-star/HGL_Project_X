/** ── QUANDO RICHIAMARLO, DALLA CHAT ─────────────────────────────────────────
 *  Richiesta del titolare (29/10/2026): «se cambio in Richiamo concordato non
 *  mi dà quando richiamarlo; devo avere il filtro di quando richiamarlo, oggi,
 *  domani ecc. con le date, da WhatsApp».
 *  La data la chiede già la finestra dello stato (QUANDO_PER_STATO →
 *  `dataRicontatto` / `oraRicontatto`): qui si legge e si mostra
 *   · nella riga dell'elenco e nell'intestazione della chat
 *     («Richiamo oggi 15:00», rosso se è passato);
 *   · nel filtro di «Da chiamare»: Scaduti, Oggi, Domani, poi una voce per data.
 *  ⚠️ VALE SOLO PER GLI STATI CHE QUELLA DATA LA CHIEDONO (richiamo, ci
 *   ricontatta lui, sta valutando…): una `dataRicontatto` rimasta da uno stato
 *   di prima non è un appuntamento, e mostrarla manderebbe a chiamare a vuoto.
 *  ⚠️ I GIORNI SONO STRINGHE «AAAA-MM-GG» DELL'OROLOGIO LOCALE, come tutte le
 *   date del CRM (`oggiIso`): si confrontano come testo.
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

/** Il filtro: «tutti», «scaduti», «oggi», «domani», «senza» (in uno stato di
 *  richiamo ma senza data: va sistemato) oppure un giorno «AAAA-MM-GG». */
export type FiltroRichiamo = "tutti" | "scaduti" | "oggi" | "domani" | "senza" | string;

/** In quale voce del filtro cade un richiamo. `null` = la chat non ha un
 *  richiamo da fare (stato che non lo prevede). */
export function vocePer(
  d: DatiConRichiamo | null | undefined,
  oggi: string,
): Exclude<FiltroRichiamo, "tutti"> | null {
  const r = richiamoDi(d);
  if (!r) {
    const regola = QUANDO_PER_STATO[String(d?.stato ?? "") as LeadStatus];
    return regola?.chiaveData === "dataRicontatto" ? "senza" : null;
  }
  if (r.data < oggi) return "scaduti";
  if (r.data === oggi) return "oggi";
  if (r.data === piu(oggi, 1)) return "domani";
  return r.data;
}

/** Passa il filtro? Con «tutti» passa tutto, anche chi un richiamo non ce l'ha. */
export function passaRichiamo(
  d: DatiConRichiamo | null | undefined,
  filtro: FiltroRichiamo,
  oggi: string,
): boolean {
  return filtro === "tutti" || vocePer(d, oggi) === filtro;
}

export interface VoceFiltro {
  v: FiltroRichiamo;
  l: string;
  n: number;
}

const maiuscola = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** Le voci del filtro con quante chat ci sono, nell'ordine in cui si lavorano:
 *  Scaduti, Oggi, Domani, i giorni dopo in ordine, Senza data. Le voci a zero
 *  non ci sono (tranne «Tutti»). */
export function vociFiltro(
  dati: (DatiConRichiamo | null | undefined)[],
  oggi: string,
): VoceFiltro[] {
  const conti = new Map<string, number>();
  for (const d of dati) {
    const v = vocePer(d, oggi);
    if (v) conti.set(v, (conti.get(v) ?? 0) + 1);
  }
  const fissi: VoceFiltro[] = [
    { v: "scaduti", l: "Scaduti", n: conti.get("scaduti") ?? 0 },
    { v: "oggi", l: "Oggi", n: conti.get("oggi") ?? 0 },
    { v: "domani", l: "Domani", n: conti.get("domani") ?? 0 },
  ];
  const giorni = [...conti.keys()]
    .filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k))
    .sort()
    .map((k) => ({ v: k, l: maiuscola(giornoParlato(k) ?? k), n: conti.get(k)! }));
  const totale = [...conti.values()].reduce((a, b) => a + b, 0);
  return [
    { v: "tutti", l: "Tutti", n: totale },
    ...fissi,
    ...giorni,
    { v: "senza", l: "Senza data", n: conti.get("senza") ?? 0 },
  ].filter((x) => x.v === "tutti" || x.n > 0);
}

/** Per ordinare: prima i richiami più vecchi (gli scaduti), dentro il giorno
 *  per ora (senza ora = in fondo al giorno); chi non ha data in fondo. */
export function chiaveOrdine(d?: DatiConRichiamo | null): string {
  const r = richiamoDi(d);
  return r ? `${r.data} ${r.ora ?? "99:99"}` : "9999-99-99";
}

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
