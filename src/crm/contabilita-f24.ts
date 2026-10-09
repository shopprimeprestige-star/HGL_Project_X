/** ── L'F24, PRECOMPILATO ───────────────────────────────────────────────────
 *
 *  Richiesta del committente. Quello che si può fare davvero, e quello che no:
 *
 *  ── ⚠️ QUESTO NON PAGA NIENTE, E NON PUÒ ──────────────────────────────────
 *  Una società con partita IVA NON può pagare l'F24 su carta: deve usare i
 *  servizi telematici dell'Agenzia (Entratel/Fisconline) o l'home banking
 *  della sua banca. È l'art. 37 c. 49 del DL 223/2006, e non ha eccezioni per
 *  le piccole. Stampare un modulo che sembra un F24 vorrebbe dire produrre un
 *  documento che ha l'aria di essere buono e che allo sportello non serve a
 *  niente — la cosa peggiore che un programma possa dare in mano a qualcuno.
 *
 *  Quello che serve davvero, invece, è sapere COSA SCRIVERE nelle caselle:
 *  quale codice tributo, per quale periodo, quanto. Sono quattro numeri che
 *  ogni trimestre si vanno a cercare, e che questo conto sa già. Il prospetto
 *  qui sotto li mette in fila, pronti da ricopiare — e dice che vanno
 *  ricopiati, non che sono stati pagati.
 *
 *  ── ⚠️ SOLO L'IVA, E IL MOTIVO È SERIO ────────────────────────────────────
 *  L'IVA questo programma la sa: viene dalle fatture emesse e da quelle
 *  ricevute, documento per documento. IRES e IRAP no — non perché sia
 *  difficile moltiplicare, ma perché il loro F24 non è mai una riga sola: è un
 *  saldo dell'anno prima più due acconti calcolati su quanto si è pagato
 *  l'anno prima, con la possibilità di ridurli. Sono numeri che stanno nella
 *  dichiarazione dell'anno scorso, che il CRM non ha. Scriverli lo stesso
 *  vorrebbe dire mettere in un modulo di pagamento una cifra inventata.
 *  Il prospetto lo dice, invece di lasciare un vuoto che sembra una svista.
 *
 *  ── I CODICI ──────────────────────────────────────────────────────────────
 *  Sono quelli ordinari, e li conferma il commercialista: un codice tributo
 *  sbagliato manda i soldi su un altro tributo, e recuperarli è un'istanza.
 *  ───────────────────────────────────────────────────────────────────────── */
import type { ContoFiscale } from "./contabilita";
import type { Periodo } from "./contabilita-periodo";
import type { RegimeLiquidazione } from "./contabilita-scadenze";

export interface RigaF24 {
  /** La sezione del modello: qui è sempre l'Erario. */
  sezione: string;
  codice: string;
  /** «0002» per il secondo trimestre, «0007» per luglio, «0000» per l'anno. */
  periodo: string;
  anno: string;
  importo: number;
  /** Cosa è, in parole: sta accanto alla riga perché chi ricopia sappia cosa
   *  sta ricopiando. */
  cosa: string;
}

const due = (n: number) => String(n).padStart(2, "0");

/** ── ⚠️ IL QUARTO TRIMESTRE NON HA UN CODICE SUO ──────────────────────────
 *  Chi liquida ogni tre mesi PER OPZIONE non versa il quarto trimestre con un
 *  codice trimestrale: quell'IVA confluisce nel conguaglio annuale, che si
 *  paga con il 6099 entro il 16 marzo. Il codice 6034 esiste, ma è dei
 *  trimestrali «speciali» dell'art. 74 — benzinai, autotrasportatori — e usarlo
 *  qui manderebbe i soldi su un tributo che non è il nostro. */
const CODICE_TRIMESTRE: Record<number, string> = { 1: "6031", 2: "6032", 3: "6033", 4: "6099" };

/** L'1% che l'opzione trimestrale costa sui primi tre trimestri. Sul quarto no:
 *  si versa con il conguaglio annuale, e lì gli interessi non ci sono. */
export const CODICE_INTERESSI = "1668";

/** Il trimestre di un periodo, o `null` se il periodo non è un trimestre. */
const trimestreDi = (p: Periodo): number | null => {
  if (p.tipo !== "trimestre") return null;
  const m = Number(p.dal.slice(5, 7));
  return m >= 1 && m <= 12 ? Math.floor((m - 1) / 3) + 1 : null;
};

/** ── LE RIGHE DA RICOPIARE ─────────────────────────────────────────────────
 *  Torna anche l'elenco vuoto, e va benissimo: un trimestre in cui non si deve
 *  niente non ha un F24 da fare, e dirlo è un'informazione.
 *
 *  ⚠️ IL CREDITO NON DIVENTA UNA RIGA. Quando l'IVA a credito supera quella a
 *   debito non si compila nessun F24: quel credito si porta al periodo dopo.
 *   Metterlo qui come «importo a credito» inviterebbe a compensarlo, e la
 *   compensazione ha regole sue — visto del conformatore sopra i 5.000 €,
 *   limiti annui — che questo programma non conosce. */
export function righeF24(
  conto: ContoFiscale,
  periodo: Periodo,
  regime: RegimeLiquidazione,
): RigaF24[] {
  if (conto.ivaDaVersare <= 0) return [];
  const anno = periodo.dal.slice(0, 4);
  const righe: RigaF24[] = [];

  if (regime === "mensile" && periodo.tipo === "mese") {
    const mese = Number(periodo.dal.slice(5, 7));
    righe.push({
      sezione: "Erario",
      codice: `60${due(mese)}`,
      periodo: `00${due(mese)}`,
      anno,
      importo: conto.ivaDaVersare,
      cosa: `IVA di ${periodo.nome}`,
    });
    return righe;
  }

  const t = trimestreDi(periodo);
  if (regime === "trimestrale" && t) {
    righe.push({
      sezione: "Erario",
      codice: CODICE_TRIMESTRE[t],
      periodo: t === 4 ? "0000" : `000${t}`,
      anno,
      importo: conto.ivaDaVersare,
      cosa:
        t === 4
          ? "IVA del quarto trimestre, dentro il conguaglio annuale"
          : `IVA del ${t}° trimestre`,
    });
    //  L'1% dell'opzione trimestrale: si versa insieme, con un codice suo.
    if (t !== 4) {
      const interessi = Math.round(conto.ivaDaVersare * 0.01 * 100) / 100;
      if (interessi > 0) {
        righe.push({
          sezione: "Erario",
          codice: CODICE_INTERESSI,
          periodo: `000${t}`,
          anno,
          importo: interessi,
          cosa: "Interessi dell'1% sulla liquidazione trimestrale",
        });
      }
    }
    return righe;
  }

  /*  ⚠️ Un periodo che non combacia con la liquidazione — l'anno intero, o un
      mese mentre si liquida per trimestri — non ha un F24 suo: l'F24 lo fa il
      PERIODO DI LIQUIDAZIONE, non la finestra che si sta guardando. Tornare
      una riga qui vorrebbe dire proporre di versare dodici mesi insieme. */
  return [];
}

/** Quanto si versa in tutto, interessi compresi. */
export const totaleF24 = (righe: RigaF24[]): number =>
  Math.round(righe.reduce((s, r) => s + r.importo, 0) * 100) / 100;

/** Perché non c'è nessuna riga: la differenza fra «non devi niente» e «questa
 *  finestra non è un periodo di liquidazione» è tutta, e un elenco vuoto da
 *  solo non la dice. */
export function perchePerNiente(
  conto: ContoFiscale,
  periodo: Periodo,
  regime: RegimeLiquidazione,
): string {
  if (conto.creditoIvaDaRiportare > 0) {
    return "Non c'è niente da versare: in questo periodo l'IVA sugli acquisti supera quella sulle vendite. Il credito che avanza si porta al periodo dopo — compensarlo ha regole sue, e le sa il commercialista.";
  }
  if (conto.ivaDaVersare <= 0) {
    return "Non c'è niente da versare in questo periodo.";
  }
  const giusto = regime === "mensile" ? "un mese" : "un trimestre";
  return `L'F24 lo fa il periodo di liquidazione, che per te è ${giusto}: scegli ${giusto} qui sopra e il prospetto compare. Sommare più periodi in un versamento solo non si può.`;
}
