/** ── CRUSCOTTO WHATSAPP · IL CALCOLO (30/10/2026) ───────────────────────────
 *
 *  Pacchetto p4-cruscotto-wa. Dai dati già letti dal server ai numeri della
 *  pagina «Cruscotto WhatsApp». Puro: niente database, niente React. Prove in
 *  `prove/manychat/cruscotto-wa.mjs`. Le definizioni scritte stanno in
 *  `~/Documents/Reel Studio/11-tecnico/kpi/definizioni.md`.
 *
 *  ⚠️ NESSUN DATO DEL CLIENTE ESCE DA QUI: l'ingresso porta il numero del
 *   cliente solo per contare le persone distinte, l'uscita solo conteggi,
 *   tassi, minuti e importi.
 *  ⚠️ I GIORNI sono giorni di calendario di Roma, oggi compreso.
 *  ⚠️ NON SI CALCOLA UN COSTO NUOVO: la categoria di un modello e le tariffe di
 *   listino arrivano da `chatwa/costi-whatsapp` (un solo posto per le cifre); qui
 *   le tariffe si possono sostituire con quelle scelte dal titolare.
 *  ───────────────────────────────────────────────────────────────────────── */
import { aRoma } from "../promemoria/formati";
import { istanteDiRoma } from "../manychat/contatto";
import {
  TARIFFE,
  categoriaConosciuta,
  categoriaModello,
  type CategoriaCosto,
} from "../chatwa/costi-whatsapp";
import type { Costi } from "../chatwa/calcolo-costi";

export type PeriodoCruscotto = "7" | "30" | "90";
export const PERIODI_CRUSCOTTO: { id: PeriodoCruscotto; etichetta: string; giorni: number }[] = [
  { id: "7", etichetta: "7 giorni", giorni: 7 },
  { id: "30", etichetta: "30 giorni", giorni: 30 },
  { id: "90", etichetta: "90 giorni", giorni: 90 },
];
export const PERIODO_CRUSCOTTO_INIZIALE: PeriodoCruscotto = "7";
export const periodoCruscottoValido = (p: unknown): p is PeriodoCruscotto =>
  PERIODI_CRUSCOTTO.some((x) => x.id === p);

/** Oltre questi minuti un lead nuovo senza risposta è «in ritardo». */
export const SOGLIA_MINUTI_PREDEFINITA = 10;
/** Una prenotazione conta per un messaggio se arriva entro questi giorni dall'invio. */
export const FINESTRA_PRENOTAZIONE_GIORNI = 7;
const MS_GIORNO = 86_400_000;
const MS_ORA = 3_600_000;

export type Tariffe = Record<CategoriaCosto, number>;
export const TARIFFE_PREDEFINITE: Tariffe = { ...TARIFFE };

/** Le tariffe scelte dal titolare: un numero non valido torna a quello di listino. */
export function tariffeValide(
  x: { marketing?: unknown; utility?: unknown } | null | undefined,
): Tariffe {
  const ok = (v: unknown, ripiego: number) => {
    const n = typeof v === "string" ? Number(v.replace(",", ".")) : Number(v);
    return Number.isFinite(n) && n >= 0 && n <= 5 ? Math.round(n * 1e6) / 1e6 : ripiego;
  };
  return {
    marketing: ok(x?.marketing, TARIFFE.marketing),
    utility: ok(x?.utility, TARIFFE.utility),
  };
}
export function sogliaValida(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 1 && n <= 240 ? Math.round(n) : SOGLIA_MINUTI_PREDEFINITA;
}

// ── ingressi (già ridotti dal server) ───────────────────────────────────────
export interface MessaggioWa {
  creatoIl: string;
  direzione: "inbound" | "outbound";
  /** `manychat` | `baileys` | `cloud` | null (= cloud di prima) */
  canale: string | null;
  stato: string;
  /** il numero del cliente, solo cifre: serve a contare le persone distinte */
  cliente: string;
  /** la riga è l'eco/doppione di un'altra (`duplicato_di` valorizzato) */
  doppione: boolean;
}
export interface InvioRegistro {
  tipo: string;
  stato: string;
  motivo: string | null;
  /** il modello del flusso, se si è riusciti a risalirci */
  modello: string | null;
  conFlusso: boolean;
  inviatoIl: string | null;
  prenotatoIl: string | null;
  rispostaIl: string | null;
  leadId: string | null;
}
export interface SchedaLead {
  id: string;
  creatoIl: string | null;
  primoContattoIl: string | null;
  consulenteId: string | null;
  stato: string;
  fissatoIl: string | null;
  importato: boolean;
}

// ── utilità ─────────────────────────────────────────────────────────────────
const ms = (iso: string | null | undefined): number => (iso ? Date.parse(iso) : NaN);
const arrotonda = (n: number, c = 6) => Math.round(n * 10 ** c) / 10 ** c;
const tasso = (a: number, b: number): number | null =>
  b > 0 ? Math.round((a / b) * 1000) / 10 : null;

/** I giorni di Roma del periodo, dal più vecchio a oggi. */
export function giorniDelPeriodo(periodo: string, adesso: Date): string[] {
  const n = PERIODI_CRUSCOTTO.find((p) => p.id === periodo)?.giorni ?? 7;
  const [a, m, g] = aRoma(adesso).giorno.split("-").map(Number);
  return Array.from({ length: n }, (_, i) =>
    new Date(Date.UTC(a, m - 1, g - (n - 1 - i))).toISOString().slice(0, 10),
  );
}
/** La mezzanotte di Roma da cui comincia il periodo. */
export function inizioCruscotto(periodo: string, adesso: Date): Date {
  const primo = giorniDelPeriodo(periodo, adesso)[0];
  return istanteDiRoma(primo, "00:00") ?? new Date(adesso.getTime() - 7 * MS_GIORNO);
}
const giornoDi = (iso: string | null | undefined): string => {
  const t = ms(iso);
  return Number.isFinite(t) ? aRoma(new Date(t)).giorno : "";
};
const mediana = (v: number[]): number | null => {
  if (!v.length) return null;
  const s = [...v].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// ── 1. PER GIORNO ───────────────────────────────────────────────────────────
export interface RigaGiorno {
  giorno: string;
  /** messaggi usciti dal CRM (ManyChat o Cloud), consegnati o in corso: non i falliti */
  inviati: number;
  /** usciti dal telefono (ponte): solo da mostrare */
  dalTelefono: number;
  /** persone distinte che hanno scritto (eco e doppioni esclusi) */
  risposte: number;
  /** appuntamenti presi nel giorno da lead che WhatsApp aveva già toccato */
  prenotazioni: number;
}

export function perGiorno(
  messaggi: readonly MessaggioWa[],
  schede: readonly SchedaLead[],
  leadConWa: ReadonlySet<string>,
  periodo: string,
  adesso: Date,
): RigaGiorno[] {
  const giorni = giorniDelPeriodo(periodo, adesso);
  const righe = new Map<string, RigaGiorno>(
    giorni.map((g) => [g, { giorno: g, inviati: 0, dalTelefono: 0, risposte: 0, prenotazioni: 0 }]),
  );
  const persone = new Map<string, Set<string>>();
  const fine = adesso.getTime();
  for (const m of messaggi) {
    const t = ms(m.creatoIl);
    if (!Number.isFinite(t) || t > fine || m.doppione) continue;
    const r = righe.get(giornoDi(m.creatoIl));
    if (!r) continue;
    if (m.direzione === "outbound") {
      if (m.stato === "failed") continue;
      if (m.canale === "baileys") r.dalTelefono++;
      else r.inviati++;
    } else {
      const chiave = m.cliente || "?";
      const set = persone.get(r.giorno) ?? new Set<string>();
      set.add(chiave);
      persone.set(r.giorno, set);
    }
  }
  for (const [g, set] of persone) (righe.get(g) as RigaGiorno).risposte = set.size;
  for (const s of schede) {
    const r = righe.get(giornoDi(s.fissatoIl));
    if (r && leadConWa.has(s.id)) r.prenotazioni++;
  }
  return giorni.map((g) => righe.get(g) as RigaGiorno);
}

// ── 2. PER MODELLO ──────────────────────────────────────────────────────────
export interface RigaModello {
  /** nome del modello, o il tipo dell'invio se il modello non si conosce */
  modello: string;
  categoria: CategoriaCosto;
  /** la categoria viene dall'elenco vero dei modelli (se no è una stima) */
  categoriaCerta: boolean;
  inviati: number;
  /** inviati a una scheda lead: il denominatore della prenotazione */
  conScheda: number;
  risposte: number;
  prenotazioni: number;
  /** % di risposta sugli inviati; null se non ne è partito nessuno */
  tassoRisposta: number | null;
  /** % di prenotazione sugli inviati a una scheda; null se nessuno */
  tassoPrenotazione: number | null;
  costo: number;
}

export function perModello(
  invii: readonly InvioRegistro[],
  schede: readonly SchedaLead[],
  tariffe: Tariffe,
  periodo: string,
  adesso: Date,
): RigaModello[] {
  const dal = inizioCruscotto(periodo, adesso).getTime();
  const fissata = new Map<string, number>();
  for (const s of schede) {
    const t = ms(s.fissatoIl);
    if (Number.isFinite(t)) fissata.set(s.id, t);
  }
  const mappa = new Map<string, RigaModello>();
  for (const i of invii) {
    //  Si contano gli invii partiti con un modello. Testo libero e prove no.
    if (i.stato !== "inviato" || i.tipo === "prova") continue;
    if (!i.modello && !i.conFlusso) continue;
    const t = ms(i.inviatoIl);
    if (!Number.isFinite(t) || t < dal || t > adesso.getTime()) continue;
    const nome = i.modello || i.tipo;
    const categoria = categoriaModello(i.modello || "");
    const r = mappa.get(nome) ?? {
      modello: nome,
      categoria,
      categoriaCerta: categoriaConosciuta(i.modello || ""),
      inviati: 0,
      conScheda: 0,
      risposte: 0,
      prenotazioni: 0,
      tassoRisposta: null,
      tassoPrenotazione: null,
      costo: 0,
    };
    r.inviati++;
    if (i.rispostaIl) r.risposte++;
    if (i.leadId) {
      r.conScheda++;
      const f = fissata.get(i.leadId);
      if (f !== undefined && f >= t && f <= t + FINESTRA_PRENOTAZIONE_GIORNI * MS_GIORNO)
        r.prenotazioni++;
    }
    mappa.set(nome, r);
  }
  return [...mappa.values()]
    .map((r) => ({
      ...r,
      tassoRisposta: tasso(r.risposte, r.inviati),
      tassoPrenotazione: tasso(r.prenotazioni, r.conScheda),
      costo: arrotonda(r.inviati * tariffe[r.categoria]),
    }))
    .sort((a, b) => b.inviati - a.inviati || a.modello.localeCompare(b.modello));
}

// ── 3. COSTO STIMATO ────────────────────────────────────────────────────────
export interface CostoStimato {
  totale: number;
  messaggi: number;
  categorie: { categoria: CategoriaCosto; messaggi: number; tariffa: number; costo: number }[];
  /** messaggi di cui il modello non si conosce: costo stimato */
  stimati: number;
  /** vero se le tariffe non sono quelle di listino di Meta */
  tariffePersonalizzate: boolean;
}

/** Il costo già calcolato dal pannello della chat, rifatto con le tariffe scelte. */
export function costoConTariffe(costi: Costi, tariffe: Tariffe): CostoStimato {
  const categorie = costi.categorie.map((c) => ({
    categoria: c.categoria,
    messaggi: c.messaggi,
    tariffa: tariffe[c.categoria],
    costo: arrotonda(c.messaggi * tariffe[c.categoria]),
  }));
  return {
    totale: arrotonda(categorie.reduce((n, c) => n + c.costo, 0)),
    messaggi: categorie.reduce((n, c) => n + c.messaggi, 0),
    categorie,
    stimati: costi.stimati,
    tariffePersonalizzate:
      tariffe.marketing !== TARIFFE.marketing || tariffe.utility !== TARIFFE.utility,
  };
}

// ── 4. VELOCITÀ DI RISPOSTA PER CONSULENTE ──────────────────────────────────
export interface RigaConsulente {
  /** `""` = lead senza consulente */
  consulenteId: string;
  nome: string;
  /** lead nuovi nel periodo */
  lead: number;
  /** quelli già contattati */
  contattati: number;
  /** mediana dei minuti fra arrivo e primo contatto; null se nessuno */
  medianaMinuti: number | null;
  /** % dei contattati entro la soglia */
  entroSoglia: number | null;
  /** ancora «Da contattare» (senza primo contatto) */
  inAttesa: number;
  /** fra questi, già oltre la soglia adesso */
  inRitardoOra: number;
  /** senza il dato del primo contatto (schede di prima del campo) */
  senzaDato: number;
  /** mediana oltre la soglia o almeno un lead in ritardo adesso */
  avviso: boolean;
}

export function velocitaConsulenti(
  schede: readonly SchedaLead[],
  nomi: ReadonlyMap<string, string>,
  sogliaMinuti: number,
  periodo: string,
  adesso: Date,
): RigaConsulente[] {
  const dal = inizioCruscotto(periodo, adesso).getTime();
  const ora = adesso.getTime();
  const per = new Map<string, { s: SchedaLead[]; minuti: number[]; r: RigaConsulente }>();
  for (const s of schede) {
    const nato = ms(s.creatoIl);
    //  Un lead importato da una lista non è un lead nuovo: il suo createdAt è quello del caricamento.
    if (s.importato || !Number.isFinite(nato) || nato < dal || nato > ora) continue;
    const id = s.consulenteId ?? "";
    const voce = per.get(id) ?? {
      s: [],
      minuti: [],
      r: {
        consulenteId: id,
        nome: id ? (nomi.get(id) ?? "Consulente") : "Senza consulente",
        lead: 0,
        contattati: 0,
        medianaMinuti: null,
        entroSoglia: null,
        inAttesa: 0,
        inRitardoOra: 0,
        senzaDato: 0,
        avviso: false,
      },
    };
    voce.r.lead++;
    const primo = ms(s.primoContattoIl);
    if (Number.isFinite(primo) && primo >= nato) {
      voce.r.contattati++;
      voce.minuti.push((primo - nato) / 60_000);
    } else if (s.stato === "da_contattare") {
      voce.r.inAttesa++;
      if ((ora - nato) / 60_000 > sogliaMinuti) voce.r.inRitardoOra++;
    } else {
      voce.r.senzaDato++;
    }
    per.set(id, voce);
  }
  return [...per.values()]
    .map(({ minuti, r }) => {
      const med = mediana(minuti);
      return {
        ...r,
        medianaMinuti: med === null ? null : Math.round(med * 10) / 10,
        entroSoglia: tasso(minuti.filter((m) => m <= sogliaMinuti).length, minuti.length),
        avviso: (med !== null && med > sogliaMinuti) || r.inRitardoOra > 0,
      };
    })
    .sort((a, b) => b.lead - a.lead || a.nome.localeCompare(b.nome));
}

// ── 5. SALDO: IL SEGNALE INDIRETTO ──────────────────────────────────────────
//  ⚠️ NÉ ManyChat NÉ Meta danno il saldo con una chiamata (API di ManyChat: 34
//   chiamate, nessuna sul Wallet; Meta: nessun saldo prepagato leggibile). Si
//   guarda quindi il sintomo: gli invii che il registro segna «fallito» con
//   motivo `blocco` (chiave, canale, modello in pausa, limite, CREDITO) e il
//   giro fermato da solo. È un avviso, non una diagnosi: dice «guarda il Wallet».
export type LivelloSaldo = "ok" | "attenzione" | "allarme";
export interface SegnaleSaldo {
  livello: LivelloSaldo;
  frase: string;
  bloccati24h: number;
  inviati24h: number;
  giroFermato: boolean;
}
export const FRASE_SALDO_MANUALE =
  "ManyChat e Meta non permettono di leggere il saldo: controlla il Wallet in ManyChat (Impostazioni → Fatturazione).";

export function segnaleSaldo(
  invii: readonly Pick<InvioRegistro, "stato" | "motivo" | "inviatoIl" | "prenotatoIl">[],
  config: { acceso: boolean; fermatoMotivo: string | null } | null,
  adesso: Date,
): SegnaleSaldo {
  const da = adesso.getTime() - 24 * MS_ORA;
  let bloccati = 0;
  let inviati = 0;
  let ultimoBlocco = 0;
  let ultimoInviato = 0;
  for (const i of invii) {
    const t = ms(i.stato === "inviato" ? i.inviatoIl : i.prenotatoIl);
    if (!Number.isFinite(t) || t < da || t > adesso.getTime()) continue;
    if (i.stato === "inviato") {
      inviati++;
      ultimoInviato = Math.max(ultimoInviato, t);
    } else if (i.stato === "fallito" && i.motivo === "blocco") {
      bloccati++;
      ultimoBlocco = Math.max(ultimoBlocco, t);
    }
  }
  const giroFermato = !!config && !config.acceso && !!config.fermatoMotivo;
  const bloccoInCorso = bloccati > 0 && ultimoBlocco > ultimoInviato;
  let livello: LivelloSaldo = "ok";
  let frase = "Nessun invio bloccato nelle ultime 24 ore.";
  if (bloccati >= 2 && bloccoInCorso) {
    livello = "allarme";
    frase = `${bloccati} invii bloccati nelle ultime 24 ore e nessuno partito dopo: può essere il credito finito (o chiave e canale). ${FRASE_SALDO_MANUALE}`;
  } else if (giroFermato && bloccati > 0) {
    livello = "allarme";
    frase = `Il giro automatico si è fermato da solo dopo invii bloccati. ${FRASE_SALDO_MANUALE}`;
  } else if (bloccati > 0) {
    livello = "attenzione";
    frase = `${bloccati} invio bloccato nelle ultime 24 ore, ma poi altri sono partiti. Tienilo d'occhio. ${FRASE_SALDO_MANUALE}`;
  }
  return { livello, frase, bloccati24h: bloccati, inviati24h: inviati, giroFermato };
}
