/** ── I COSTI WHATSAPP PER PERIODO · IL CALCOLO (29/10/2026) ─────────────────
 *
 *  Dagli invii arrivati (righe di `manychat_invii` già ridotte a tipo, modello e
 *  istante) ai conteggi e agli importi del pannello «Costi WhatsApp». Puro: niente
 *  database, niente React. Prove in `prove/manychat/chat-costi.mjs`.
 *
 *  ⚠️ NESSUN DATO DEL CLIENTE: l'ingresso porta solo tipo, nome del modello e ora;
 *   l'uscita solo conteggi e importi.
 *  ⚠️ I PERIODI sono giorni di calendario di Roma, oggi compreso: «3 giorni» = oggi
 *   e i due giorni prima, dalla mezzanotte di Roma (ora legale o solare).
 *  ⚠️ COSA SI PAGA: un invio con un modello (arriva dal flusso di ManyChat). Un testo
 *   libero dalla chat dentro la finestra non ha flusso: si conta a parte (`testiLiberi`)
 *   e non entra nel totale.
 *  ⚠️ IL RISPARMIO (30/10/2026): un messaggio del giro (promemoria, conferma…) partito
 *   come TESTO nella finestra aperta non ha flusso, ma avrebbe avuto un modello: il
 *   risparmio è il prezzo di quel modello (`MODELLO_DEL_TIPO`) meno il costo del testo
 *   (`COSTO_TESTO_IN_FINESTRA`, gratis per Meta). Non entra nel totale. È una stima.
 *  ───────────────────────────────────────────────────────────────────────── */
import { aRoma } from "../promemoria/formati";
import { istanteDiRoma } from "../manychat/contatto";
import {
  categoriaConosciuta,
  COSTO_TESTO_IN_FINESTRA,
  categoriaModello,
  ETICHETTA_CATEGORIA,
  TARIFFE,
  type CategoriaCosto,
} from "./costi-whatsapp";

export type PeriodoCosti = "oggi" | "3" | "7" | "30" | "90";

export const PERIODI: { id: PeriodoCosti; etichetta: string; giorni: number }[] = [
  { id: "oggi", etichetta: "Oggi", giorni: 1 },
  { id: "3", etichetta: "3 giorni", giorni: 3 },
  { id: "7", etichetta: "7 giorni", giorni: 7 },
  { id: "30", etichetta: "30 giorni", giorni: 30 },
  { id: "90", etichetta: "90 giorni", giorni: 90 },
];
export const PERIODO_INIZIALE: PeriodoCosti = "oggi";

export const periodoValido = (p: unknown): p is PeriodoCosti => PERIODI.some((x) => x.id === p);

/** Una riga del registro, ridotta a quanto serve. */
export interface InvioPagato {
  /** `manychat_invii.tipo` */
  tipo: string;
  /** il modello del flusso, se si è riusciti a risalirci */
  modello: string | null;
  /** la riga ha un flusso (= è un modello, non un testo libero) */
  conFlusso: boolean;
  /** ISO */
  inviatoIl: string;
}

export interface RigaCategoria {
  categoria: CategoriaCosto;
  etichetta: string;
  messaggi: number;
  costo: number;
}
export interface RigaTipo {
  tipo: string;
  etichetta: string;
  /** `mano` = dalla chat, `automatico` = del giro */
  gruppo: "mano" | "automatico";
  messaggi: number;
  costo: number;
}
export interface Costi {
  periodo: PeriodoCosti;
  /** ISO: dove comincia il periodo (mezzanotte di Roma) */
  dal: string;
  totale: number;
  messaggi: number;
  categorie: RigaCategoria[];
  automatici: { messaggi: number; costo: number };
  mano: { messaggi: number; costo: number };
  perTipo: RigaTipo[];
  /** messaggi di cui il modello non si conosce: costo stimato con la categoria del tipo (o la più cara) */
  stimati: number;
  /** testi scritti a mano dalla chat (nessun flusso): non entrano nel totale */
  testiLiberi: number;
  /** messaggi del giro partiti come testo invece che come modello, e quanto si è risparmiato (stima) */
  risparmio: { messaggi: number; euro: number };
}

const ETICHETTE_TIPO: Record<string, string> = {
  primo_contatto: "Primo contatto",
  richiamo_24h: "Richiamo",
  ritorno: "Ritorno",
  casi_reali: "Casi reali",
  promemoria: "Promemoria",
  ricontatto: "Ricontatto",
  conferma: "Conferma",
  meet_oggi: "Meet di oggi",
  meet_domani: "Meet di domani",
  meet_adesso: "Meet adesso",
  promemoria_chiamata: "Promemoria chiamata",
  promemoria_sede: "Promemoria sede",
  chat: "Dalla chat, a mano",
  prova: "Prove dei modelli",
  webinar: "Webinar",
};

/** Il modello tipico di un tipo, per quando la riga non dice quale flusso ha mandato. */
export const MODELLO_DEL_TIPO: Record<string, string> = {
  primo_contatto: "primo_contatto",
  richiamo_24h: "richiamo_24h",
  ritorno: "ritorno",
  casi_reali: "casi_reali",
  promemoria: "promemoria_meet",
  ricontatto: "ricontatto_consulenza",
  conferma: "consulenza_conferma_presenza",
  meet_oggi: "meet_oggi",
  meet_domani: "meet_domani",
  meet_adesso: "meet_adesso",
  promemoria_chiamata: "richiamo_concordato",
  promemoria_sede: "promemoria_sede",
};

const arrotonda = (n: number) => Math.round(n * 1e6) / 1e6;

/** La mezzanotte di Roma da cui comincia il periodo. Periodo sconosciuto = Oggi. */
export function inizioPeriodo(periodo: string, adesso: Date): Date {
  const giorni = PERIODI.find((p) => p.id === periodo)?.giorni ?? 1;
  const [a, m, g] = aRoma(adesso).giorno.split("-").map(Number);
  const primo = new Date(Date.UTC(a, m - 1, g - (giorni - 1))).toISOString().slice(0, 10);
  //  istanteDiRoma non è null per un giorno vero: il ripiego è solo per il tipo.
  return istanteDiRoma(primo, "00:00") ?? new Date(adesso.getTime() - giorni * 86_400_000);
}

export function calcolaCosti(
  invii: readonly (InvioPagato | null | undefined | Record<string, never>)[],
  periodo: string,
  adesso: Date,
): Costi {
  const id = periodoValido(periodo) ? periodo : PERIODO_INIZIALE;
  const dal = inizioPeriodo(id, adesso);
  const cat = new Map<CategoriaCosto, number>([
    ["marketing", 0],
    ["utility", 0],
  ]);
  const tipi = new Map<string, RigaTipo>();
  let stimati = 0;
  let testiLiberi = 0;
  const risparmio = { messaggi: 0, euro: 0 };

  for (const i of invii as (Partial<InvioPagato> | null | undefined)[]) {
    const quando = Date.parse(i?.inviatoIl ?? "");
    if (!i || !Number.isFinite(quando) || quando < dal.getTime() || quando > adesso.getTime())
      continue;
    const tipo = String(i.tipo ?? "");
    //  Il modello: quello del flusso; se non si sa, il tipico del tipo; se la riga
    //  ha un flusso ma non si sa quale, la categoria più cara (mai sottostimare).
    //  Senza flusso è partito un TESTO, qualunque sia il tipo: dal 29/10/2026
    //  anche promemoria e giro, quando il cliente ha scritto da poco (finestra
    //  aperta). Non è un modello: niente prezzo di modello.
    if (!i.conFlusso && !i.modello) {
      //  Un tipo del giro (ha un modello tipico) partito come testo: il modello non è
      //  stato pagato, e la differenza è il risparmio. Gli altri sono testi a mano.
      const tipico = MODELLO_DEL_TIPO[tipo];
      if (tipico) {
        risparmio.messaggi++;
        risparmio.euro = arrotonda(
          risparmio.euro + Math.max(0, TARIFFE[categoriaModello(tipico, undefined, quando)] - COSTO_TESTO_IN_FINESTRA),
        );
      } else testiLiberi++;
      continue;
    }
    const modello = i.modello || MODELLO_DEL_TIPO[tipo] || null;
    const categoria = modello ? categoriaModello(modello, undefined, quando) : "marketing";
    if (!i.modello || !categoriaConosciuta(modello ?? "")) stimati++;
    cat.set(categoria, (cat.get(categoria) ?? 0) + 1);
    const riga = tipi.get(tipo) ?? {
      tipo,
      etichetta: ETICHETTE_TIPO[tipo] ?? tipo.replace(/_/g, " "),
      gruppo: tipo === "chat" ? ("mano" as const) : ("automatico" as const),
      messaggi: 0,
      costo: 0,
    };
    riga.messaggi++;
    riga.costo = arrotonda(riga.costo + TARIFFE[categoria]);
    tipi.set(tipo, riga);
  }

  const categorie = [...cat].map(([categoria, messaggi]) => ({
    categoria,
    etichetta: ETICHETTA_CATEGORIA[categoria],
    messaggi,
    costo: arrotonda(messaggi * TARIFFE[categoria]),
  }));
  const perTipo = [...tipi.values()].sort((x, y) => y.costo - x.costo || y.messaggi - x.messaggi);
  const somma = (g: RigaTipo["gruppo"]) => {
    const righe = perTipo.filter((t) => t.gruppo === g);
    return {
      messaggi: righe.reduce((n, t) => n + t.messaggi, 0),
      costo: arrotonda(righe.reduce((n, t) => n + t.costo, 0)),
    };
  };
  return {
    periodo: id,
    dal: dal.toISOString(),
    totale: arrotonda(categorie.reduce((n, x) => n + x.costo, 0)),
    messaggi: categorie.reduce((n, x) => n + x.messaggi, 0),
    categorie,
    automatici: somma("automatico"),
    mano: somma("mano"),
    perTipo,
    stimati,
    testiLiberi,
    risparmio,
  };
}
