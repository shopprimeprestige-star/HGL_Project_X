/** ── IL FILTRO PER GIORNO, DENTRO OGNI FILTRO DELLA CHAT (09/11/2026, rifatto il 16/11/2026) ──
 *  Richiesta del titolare: «quando sono dentro il filtro posso mettere tutti quelli di oggi o quelli di
 *  domani, eccetera, così li lavoro meglio». Sotto il filtro acceso compare una fila: Tutti · Scaduti ·
 *  Ieri · Oggi · Domani · Prossimi giorni · Senza data. Uno solo alla volta, in E col filtro, col
 *  consulente e con la ricerca.
 *  ⚠️ 16/11/2026: tolte «Questa settimana»/«Prossima settimana» (mescolavano arretrato e futuro nella
 *  stessa settimana: D5 dell'analisi) e il controllo a parte «Con/Senza data» di Ricontatti, che diceva
 *  la stessa cosa con un interruttore in più. «Scaduti» copre ogni arretrato senza limite, «Prossimi
 *  giorni» ogni data da dopodomani in avanti senza limite, «Senza data» è qui, nella stessa fila, per
 *  ogni filtro.
 *
 *  · LA DATA DIPENDE DALLO STATO VERO DEL LEAD, non dal filtro che lo ha portato in vista
 *    (`dataEFonte`, UNA regola sola, dal 16/11/2026):
 *      Ricontatti, una fase (uno stato) o la coda «Da chiamare» → prima la regola del SUO stato
 *        (QUANDO_PER_STATO[stato]): il campo che quello stato scrive davvero (dataRicontatto,
 *        dataMeeting o dataVieneInSede). Prima correggeva D1: un lead «Da riprogrammare»
 *        (`da_spostare`) dentro «Ricontatti» guardava sempre `dataRicontatto`, anche se la sua
 *        promessa — la nuova consulenza — è scritta in `dataMeeting`.
 *      Lo stato non ha una regola (es. «Attesa WhatsApp», «Segreteria», «Non risponde», «Da
 *        contattare»): se c'è una `dataRicontatto` scritta a mano VINCE (revisione del 16/11/2026,
 *        decisione del capo progetto); se no, dentro una fase o «Da chiamare» si cade sull'ULTIMO
 *        MESSAGGIO (la stessa ora che ordina l'elenco: `quandoUltimo`), poi l'arrivo del lead
 *        (`data.createdAt`, poi `created_at`); dentro «Ricontatti» no, resta «senza data» (sarebbe un
 *        «oggi» inventato).
 *      Ogni altro filtro (Da rispondere, con stelle, finestra, acconto, tipo…)                 → il
 *        giorno dell'ultimo messaggio, poi l'arrivo, come sopra.
 *  · I GIORNI SONO QUELLI DI ROMA (Europe/Rome). Il Worker gira in
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

/** `""` = «Tutti» (spento). «Scaduti»: ogni data prima di ieri, senza limite. «Prossimi giorni»: ogni
 *  data da dopodomani in avanti, senza limite. «Senza data»: la chat non ha una data per questo filtro
 *  (non è un intervallo di calendario: vedi `inGiorno`). */
export type GiornoChat =
  | ""
  | "scaduti"
  | "ieri"
  | "oggi"
  | "domani"
  | "prossimi-giorni"
  | "senza-data";

/** I segmenti, nell'ordine in cui si mostrano. Una sola fonte per la fila, il riepilogo e il salvataggio. */
export const SEGMENTI_GIORNO: readonly { v: GiornoChat; nome: string }[] = [
  { v: "", nome: "Tutti" },
  { v: "scaduti", nome: "Scaduti" },
  { v: "ieri", nome: "Ieri" },
  { v: "oggi", nome: "Oggi" },
  { v: "domani", nome: "Domani" },
  { v: "prossimi-giorni", nome: "Prossimi giorni" },
  { v: "senza-data", nome: "Senza data" },
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

/** Da quale a quale giorno vale il segmento, visto da `adesso`; `null` dal lato che non ha limite
 *  («Scaduti» non ha un `da`, «Prossimi giorni» non ha un `a`); l'intervallo intero è `null` per
 *  «Tutti», per «Senza data» (non è un intervallo di calendario: vedi `inGiorno`) o per un valore che
 *  non si conosce. */
export function intervalloGiorno(
  scelta: GiornoChat,
  adesso: Date,
): { da: string | null; a: string | null } | null {
  const oggi = giornoDiRoma(adesso);
  if (!oggi) return null;
  switch (scelta) {
    //  «Scaduti» = prima di ieri (ANALISI §3): oggi-2 e tutto il passato prima. «Ieri» (oggi-1) resta
    //  solo suo, nessuna sovrapposizione fra i due segmenti.
    case "scaduti":
      return { da: null, a: aggiungiGiorni(oggi, -2) };
    case "ieri":
      return { da: aggiungiGiorni(oggi, -1), a: aggiungiGiorni(oggi, -1) };
    case "oggi":
      return { da: oggi, a: oggi };
    case "domani":
      return { da: aggiungiGiorni(oggi, 1), a: aggiungiGiorni(oggi, 1) };
    case "prossimi-giorni":
      return { da: aggiungiGiorni(oggi, 2), a: null };
    default:
      return null;
  }
}

/** Il giorno cade nel segmento? «Tutti» fa passare tutti (anche chi non ha giorno); «Senza data» vuole
 *  esattamente chi non ne ha; ogni altro segmento esclude chi non ha giorno, e un lato `null`
 *  dell'intervallo non pone limite da quella parte (es. «Scaduti»: tutto il passato, senza fondo). */
export function inGiorno(giorno: string, scelta: GiornoChat, adesso: Date): boolean {
  if (scelta === "") return true;
  if (scelta === "senza-data") return giorno === "";
  if (!giorno) return false;
  const r = intervalloGiorno(scelta, adesso);
  if (!r) return false;
  if (r.da !== null && giorno < r.da) return false;
  if (r.a !== null && giorno > r.a) return false;
  return true;
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

/** `coda` conta solo per sapere se applicare questa regola quando NON c'è uno stato scelto come fase
 *  (cioè: «Da chiamare»). Facoltativo: chi non lo passa si comporta come prima del 16/11/2026. */
type FiltroPerData = Pick<FiltriChat, "fase" | "ricontatti"> & { coda?: FiltriChat["coda"] };

const CAMPO_DELLA_FONTE = {
  dataRicontatto: "ricontatto",
  dataMeeting: "consulenza",
  dataVieneInSede: "sede",
} as const;

/** La data del filtro e da dove viene. `giorno === ""`: la chat non ha una data per questo filtro.
 *  UNA regola sola (16/11/2026, corregge D1 e D2): Ricontatti, una fase o «Da chiamare» guardano
 *  prima la regola del VERO stato del lead (`QUANDO_PER_STATO`), non quella che il filtro
 *  presupporrebbe. */
export function dataEFonte(
  c: ChatPerGiorno,
  f: FiltroPerData,
): { giorno: string; fonte: FonteData | null } {
  const d = c.lead?.data;
  if (f.ricontatti || f.fase || f.coda === "da-chiamare") {
    const regola = QUANDO_PER_STATO[String(d?.stato ?? "") as LeadStatus];
    if (regola) {
      const giorno = giornoScheda(d?.[regola.chiaveData]);
      return { giorno, fonte: giorno ? CAMPO_DELLA_FONTE[regola.chiaveData] : null };
    }
    //  Stato senza regola (Da contattare, Non risponde, Segreteria…). Revisione del 16/11/2026,
    //  decisione del capo progetto: una data di ricontatto/richiamo scritta a mano vince SEMPRE sul
    //  ripiego dell'ultimo messaggio (un «Non risponde» richiamato venerdì sta in «Prossimi giorni»,
    //  non in «Scaduti»; un «Da contattare» con ricontatto domani sta in «Domani», come la pastiglia).
    const scritto = giornoScheda(d?.dataRicontatto);
    if (scritto) return { giorno: scritto, fonte: "ricontatto" };
    //  Senza data scritta, «Ricontatti» non ripiega sull'ultimo messaggio (inventare una data sarebbe
    //  il D1 di nuovo); «Da chiamare» e le fasi cadono nel caso sotto, come sempre.
    if (f.ricontatti) return { giorno: "", fonte: null };
  }
  //  Tutti gli altri (compresi gli stati senza regola e senza data scritta, dentro una fase o «Da
  //  chiamare»): l'ultimo messaggio, poi l'arrivo del lead.
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
/** Stati senza regola dentro Da chiamare / una fase: la data scritta vince, se no l'ultimo messaggio. */
const RICONTATTO_O_ULTIMO = `${COSA_DICE.dataRicontatto} se è scritto, se no ${DATA_ULTIMO}`;

/** Quale data guarda il filtro, a parole (per la fila dei giorni): la stessa scelta di `dataEFonte`,
 *  letta dal filtro invece che dalla chat. */
export function descriviDataFiltro(f: FiltroPerData): string {
  //  «Ricontatti» include anche stati senza una regola propria (es. «Da riprogrammare», «Da
  //  contattare»): dice la verità, non solo «il giorno del ricontatto» come se valesse per tutti.
  if (f.ricontatti)
    return `${COSA_DICE.dataRicontatto}, o ${COSA_DICE.dataMeeting} se il lead è da riprogrammare`;
  //  «Da chiamare»: solo richiamo e ci ricontatta lui hanno un giorno di richiamo (QUANDO_PER_STATO);
  //  gli altri tre stati della coda (da chiamare, non risponde, segreteria) non ne hanno uno.
  if (f.coda === "da-chiamare") return RICONTATTO_O_ULTIMO;
  if (f.fase === "per-ora-no") return COSA_DICE.dataRicontatto;
  if (f.fase === "sospeso-clienti") return RICONTATTO_O_ULTIMO;
  const stato = f.fase?.startsWith("stato:") ? f.fase.slice(6) : "";
  const regola = QUANDO_PER_STATO[stato as LeadStatus];
  if (regola) return COSA_DICE[regola.chiaveData];
  //  Una fase senza regola (Segreteria, Attesa WhatsApp…): la data scritta vince, come in dataEFonte.
  return f.fase ? RICONTATTO_O_ULTIMO : DATA_ULTIMO;
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
  //  Un ricontatto scritto su uno stato SENZA regola (es. «Non risponde» richiamato venerdì): la
  //  pastiglia del richiamo non c'è (richiamoDi vale solo per gli stati con regola), quindi lo si dice
  //  qui. In «Ricontatti» no: lì la pastiglia della riga lo mostra già (etichettaDataRicontatto).
  if (fonte === "ricontatto" && !f.ricontatti) {
    const stato = String(c.lead?.data?.stato ?? "") as LeadStatus;
    if (!QUANDO_PER_STATO[stato]) return `Richiamo ${breve}`;
  }
  return null;
}
