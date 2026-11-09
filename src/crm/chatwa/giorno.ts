/** ── IL FILTRO PER GIORNO, DENTRO OGNI FILTRO DELLA CHAT (09/11/2026) ──────────
 *  Richiesta del titolare: «quando sono dentro il filtro posso mettere tutti quelli di oggi o quelli di
 *  domani, eccetera, così li lavoro meglio». Sotto il filtro acceso compare una fila: Tutti · Ieri · Oggi ·
 *  Domani · Questa settimana · Prossima settimana. Uno solo alla volta, in E col filtro, col consulente e
 *  con la ricerca.
 *
 *  · LA DATA DIPENDE DAL FILTRO (`dataPerGiorno`):
 *      Ricontatti, e gli stati che chiedono un ricontatto (QUANDO_PER_STATO → dataRicontatto)  → il giorno
 *        del ricontatto;
 *      gli stati con un appuntamento (dataMeeting, e dataVieneInSede per la visita in sede)    → il giorno
 *        dell'appuntamento;
 *      ogni altro filtro (Da rispondere, Da chiamare, stelle, finestra, acconto, tipo…)        → il giorno
 *        dell'ULTIMO MESSAGGIO (la stessa ora che ordina l'elenco: `quandoUltimo`); se manca, l'arrivo del
 *        lead (`data.createdAt`, poi `created_at`).
 *    Uno stato che chiede una data ma non ce l'ha NON ripiega sull'ultimo messaggio: senza data resta
 *    solo in «Tutti». Sarebbe un «oggi» inventato.
 *  · I GIORNI SONO QUELLI DI ROMA (Europe/Rome), la settimana va da lunedì a domenica. Il Worker gira in
 *    UTC: un messaggio delle 23:30Z è già il giorno dopo a Roma. Si usa `aRoma` (formati.ts), mai
 *    l'orologio del server.
 *  · L'ORA «ADESSO» È UN PARAMETRO: niente orologio qui dentro, le prove la fissano.
 *  Puro: niente React, niente Supabase. Provato in prove/idee/filtro-giorno.mjs. */
import type { LeadStatus } from "@/crm/types";
import { aRoma, giornoParlato } from "@/crm/promemoria/formati";
import { QUANDO_PER_STATO } from "@/crm/quando-per-stato";
import type { FiltriChat } from "./filtri";
import { quandoUltimo, type ChatConOra } from "./ordineWhatsapp";
import { arrivoMs } from "./ricontatti";

/** `""` = «Tutti» (spento). */
export type GiornoChat =
  | ""
  | "ieri"
  | "oggi"
  | "domani"
  | "questa-settimana"
  | "prossima-settimana";

/** I segmenti, nell'ordine in cui si mostrano. Una sola fonte per la fila, il riepilogo e il salvataggio. */
export const SEGMENTI_GIORNO: readonly { v: GiornoChat; nome: string }[] = [
  { v: "", nome: "Tutti" },
  { v: "ieri", nome: "Ieri" },
  { v: "oggi", nome: "Oggi" },
  { v: "domani", nome: "Domani" },
  { v: "questa-settimana", nome: "Questa settimana" },
  { v: "prossima-settimana", nome: "Prossima settimana" },
];

/** Il valore è uno dei segmenti? (Dal dispositivo può arrivare qualunque cosa.) */
export const giornoValido = (v: unknown): v is GiornoChat =>
  SEGMENTI_GIORNO.some((s) => s.v === v);

/** Il nome di un segmento («Oggi»); `""` per «Tutti» o per un valore sconosciuto. */
export const nomeGiorno = (v: GiornoChat): string =>
  v === "" ? "" : (SEGMENTI_GIORNO.find((s) => s.v === v)?.nome ?? "");

// ── Giorni, a Roma ──────────────────────────────────────────────────────────────────────────────

const GIORNO_VERO = /^\d{4}-\d{2}-\d{2}$/;
const unGiorno = (g: string): number => {
  const [a, m, d] = g.split("-").map(Number);
  return Date.UTC(a, m - 1, d);
};

/** «AAAA-MM-GG» più `n` giorni (anche negativi). Conta sul calendario, non sulle ore: l'ora legale non c'entra. */
export function aggiungiGiorni(giorno: string, n: number): string {
  return new Date(unGiorno(giorno) + n * 86_400_000).toISOString().slice(0, 10);
}

/** Che giorno è A ROMA in questo istante («AAAA-MM-GG»); `""` se l'istante non è una data. */
export function giornoDiRoma(istante: Date): string {
  return Number.isFinite(istante.getTime()) ? aRoma(istante).giorno : "";
}

/** Il giorno scritto sulla scheda («AAAA-MM-GG»), o `""` se manca o non è un giorno vero (la stessa
 *  regola di `dataDi` in ricontatti.ts, che lo guarda per i ricontatti). */
const giornoScheda = (v: unknown): string => {
  const g = String(v ?? "").slice(0, 10);
  return GIORNO_VERO.test(g) && giornoParlato(g) ? g : "";
};

/** Dal lunedì alla domenica che contengono `giorno`. */
function settimanaDi(giorno: string): { da: string; a: string } {
  const dalLunedi = (new Date(unGiorno(giorno)).getUTCDay() + 6) % 7;
  const da = aggiungiGiorni(giorno, -dalLunedi);
  return { da, a: aggiungiGiorni(da, 6) };
}

/** Da quale a quale giorno (compresi) vale il segmento, visto da `adesso`; `null` per «Tutti» o per un
 *  valore che non si conosce. */
export function intervalloGiorno(
  scelta: GiornoChat,
  adesso: Date,
): { da: string; a: string } | null {
  const oggi = giornoDiRoma(adesso);
  if (!oggi) return null;
  switch (scelta) {
    case "ieri":
      return { da: aggiungiGiorni(oggi, -1), a: aggiungiGiorni(oggi, -1) };
    case "oggi":
      return { da: oggi, a: oggi };
    case "domani":
      return { da: aggiungiGiorni(oggi, 1), a: aggiungiGiorni(oggi, 1) };
    case "questa-settimana":
      return settimanaDi(oggi);
    case "prossima-settimana":
      return settimanaDi(aggiungiGiorni(oggi, 7));
    default:
      return null;
  }
}

/** Il giorno cade nel segmento? «Tutti» fa passare tutti (anche chi non ha giorno); ogni altro segmento
 *  esclude chi non ha giorno. */
export function inGiorno(giorno: string, scelta: GiornoChat, adesso: Date): boolean {
  if (scelta === "") return true;
  const r = intervalloGiorno(scelta, adesso);
  return !!giorno && !!r && giorno >= r.da && giorno <= r.a;
}

// ── Quale data per quale filtro ─────────────────────────────────────────────────────────────────

/** Da dove viene la data usata. */
export type FonteData = "ricontatto" | "consulenza" | "sede" | "messaggio" | "arrivo";

/** Quello che serve di una chat: l'ora dell'ultimo messaggio e le date della scheda. */
export type ChatPerGiorno = ChatConOra & {
  lead?: {
    created_at?: string | null;
    data?: {
      stato?: string | null;
      dataRicontatto?: string | null;
      dataMeeting?: string | null;
      dataVieneInSede?: string | null;
      createdAt?: string | null;
    } | null;
  } | null;
};

type FiltroPerData = Pick<FiltriChat, "fase" | "ricontatti">;

const CAMPO_DELLA_FONTE = {
  dataRicontatto: "ricontatto",
  dataMeeting: "consulenza",
  dataVieneInSede: "sede",
} as const;

/** La data del filtro e da dove viene. `giorno === ""`: la chat non ha una data per questo filtro. */
export function dataEFonte(
  c: ChatPerGiorno,
  f: FiltroPerData,
): { giorno: string; fonte: FonteData | null } {
  const d = c.lead?.data;
  //  1. «Ricontatti»: sempre la data del ricontatto (le regole di chi entra sono in ricontatti.ts).
  if (f.ricontatti) {
    const giorno = giornoScheda(d?.dataRicontatto);
    return { giorno, fonte: giorno ? "ricontatto" : null };
  }
  //  2. Fasi/stati con una data: quella che lo stato scrive (QUANDO_PER_STATO), letta dallo stato della
  //     chat. «Attesa WhatsApp» non ne ha, quindi cade nel caso 3.
  if (f.fase) {
    const regola = QUANDO_PER_STATO[String(d?.stato ?? "") as LeadStatus];
    if (regola) {
      const giorno = giornoScheda(d?.[regola.chiaveData]);
      return { giorno, fonte: giorno ? CAMPO_DELLA_FONTE[regola.chiaveData] : null };
    }
  }
  //  3. Tutti gli altri: l'ultimo messaggio, poi l'arrivo del lead.
  const ultimo = quandoUltimo(c);
  if (ultimo > 0) return { giorno: giornoDiRoma(new Date(ultimo)), fonte: "messaggio" };
  const arrivo = arrivoMs(c);
  if (arrivo !== null) return { giorno: giornoDiRoma(new Date(arrivo)), fonte: "arrivo" };
  return { giorno: "", fonte: null };
}

/** Il giorno («AAAA-MM-GG», a Roma) che conta per questa chat col filtro acceso; `""` se non ne ha. */
export const dataPerGiorno = (c: ChatPerGiorno, f: FiltroPerData): string =>
  dataEFonte(c, f).giorno;

/** Da dove viene la data usata; `null` se la chat non ne ha. */
export const fonteDellaData = (c: ChatPerGiorno, f: FiltroPerData): FonteData | null =>
  dataEFonte(c, f).fonte;

/** La chat passa il segmento scelto in `f.giorno`? Senza giorno scelto passa sempre. */
export const passaGiorno = (
  c: ChatPerGiorno,
  f: FiltroPerData & { giorno: GiornoChat },
  adesso: Date,
): boolean => f.giorno === "" || inGiorno(dataPerGiorno(c, f), f.giorno, adesso);

const COSA_DICE = {
  dataRicontatto: "il giorno del ricontatto",
  dataMeeting: "il giorno della consulenza",
  dataVieneInSede: "il giorno della visita in sede",
} as const;
const DATA_ULTIMO = "il giorno dell'ultimo messaggio";

/** Quale data guarda il filtro, a parole (per la fila dei giorni): la stessa scelta di `dataEFonte`,
 *  letta dal filtro invece che dalla chat. */
export function descriviDataFiltro(f: FiltroPerData): string {
  if (f.ricontatti) return COSA_DICE.dataRicontatto;
  if (f.fase === "per-ora-no") return COSA_DICE.dataRicontatto;
  if (f.fase === "sospeso-clienti") return `${COSA_DICE.dataRicontatto}, o ${DATA_ULTIMO} se lo stato non ha data`;
  const stato = f.fase?.startsWith("stato:") ? f.fase.slice(6) : "";
  const regola = QUANDO_PER_STATO[stato as LeadStatus];
  return regola ? COSA_DICE[regola.chiaveData] : DATA_ULTIMO;
}

// ── La data sulla riga ──────────────────────────────────────────────────────────────────────────

const GIORNI_BREVI = ["dom", "lun", "mar", "mer", "gio", "ven", "sab"];
const MESI_BREVI = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];

/** «2026-11-09» → «lun 9 nov». `""` se non è un giorno vero. (Niente `toLocaleDateString`: dipende da chi esegue.) */
export function giornoBreve(giorno: string): string {
  if (!giornoScheda(giorno)) return "";
  const [, m, g] = giorno.split("-").map(Number);
  return `${GIORNI_BREVI[new Date(unGiorno(giorno)).getUTCDay()]} ${g} ${MESI_BREVI[m - 1]}`;
}

/** Cosa scrivere sulla riga per dire quale data ha deciso il giorno, o `null` se la riga la mostra già:
 *  l'ultimo messaggio ha la sua ora a destra e il ricontatto la sua pastiglia col calendario. Restano la
 *  consulenza, la visita in sede e l'arrivo del lead. */
export function giornoUsatoSullaRiga(c: ChatPerGiorno, f: FiltroPerData): string | null {
  const { giorno, fonte } = dataEFonte(c, f);
  const breve = giornoBreve(giorno);
  if (!breve) return null;
  if (fonte === "consulenza") return `Consulenza ${breve}`;
  if (fonte === "sede") return `In sede ${breve}`;
  if (fonte === "arrivo") return `Arrivato ${breve}`;
  return null;
}
