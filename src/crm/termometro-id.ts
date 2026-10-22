/** ── IL TERMOMETRO DEL MODULO «22-OTT» DI INVISIBLE DERM ───────────────────
 *
 *  Richiesta del titolare (22/10/2026): un termometro «severo ma equilibrato»
 *  per il modulo dell'inserzione Invisible Derm, a cinque gradi:
 *    🔴 Bollente · 🟠 Caldo · 🟡 Tiepido · 🔵 Freddo · ⚪ Gelido
 *  Non una somma di punti: le risposte si leggono insieme, e un ostacolo vero
 *  (niente budget, niente Roma, solo curiosità) non si compensa con
 *  l'entusiasmo delle altre.
 *
 *  ⚠️ È UN INDICE, NON UNA PROBABILITÀ. Finché non ci sono i dati di vendita
 *   (lead → consulenza → presenza → vendita) i pesi sono un giudizio
 *   commerciale scritto qui, non una misura. Il modo di calibrarli coi
 *   risultati veri è in fondo al file.
 *  ⚠️ DETERMINISTICO: le stesse risposte danno sempre lo stesso risultato.
 *   Nessuna chiamata a un modello, niente data di oggi, niente caso.
 *
 *  ── COME SI DECIDE, IN QUEST'ORDINE (la precedenza è questa) ──────────────
 *   0. Trapianto chirurgico → percorso a parte: niente temperatura di vendita.
 *   1. PUNTI: base 25 + un modificatore per ogni risposta DATA (tabella PESI).
 *      Le domande non raccolte non valgono né più né meno: zero. Chi dice «no»
 *      al 589€ va a Q9 e non vede D7-D8: non gli si inventano.
 *   2. CONTRADDIZIONI: si segnalano, e quelle che contano tolgono punti e
 *      mettono un tetto (REGOLA D).
 *   3. TETTI (vince il più basso):
 *        budget «no»                   → al massimo Freddo   (REGOLA A)
 *        Roma «no»                     → al massimo Tiepido  (REGOLA B)
 *        «sto solo cercando informazioni» → al massimo Tiepido (REGOLA C)
 *        «informazioni per il futuro»  → al massimo Tiepido
 *        urgenza + «per il futuro»     → al massimo Caldo    (REGOLA D)
 *   4. BOLLENTE SI GUADAGNA (REGOLA E): servono TUTTI e quattro, detti:
 *        viene a Roma · budget «sì» · inizia subito o entro 30 giorni ·
 *        dalla consulenza vuole capire come iniziare o confrontare.
 *      Manca anche uno solo (o non è stato chiesto) → al massimo Caldo.
 *   5. CALDO SI GUADAGNA: servono Roma «sì», budget «sì» o «approfondire» e
 *      un inizio entro 30 giorni. Altrimenti al massimo Tiepido.
 *   Il punteggio finale è tagliato al tetto (es. un Freddo per budget non
 *   supera 44): così numero e grado dicono sempre la stessa cosa.
 *
 *  ── Q9, IL BUDGET SCRITTO A MANO ─────────────────────────────────────────
 *   Se dopo «no» scrive una cifra di 589€ o più, si contraddice: il budget si
 *   rilegge come «vuole approfondire» (il tetto di Freddo cade) e la
 *   contraddizione si scrive. Una cifra più bassa resta un ostacolo, con la
 *   cifra. Nessuna cifra: resta «budget insufficiente».
 *  ───────────────────────────────────────────────────────────────────────── */
import type { RisposteModulo } from "@/crm/types";

export type GradoID = "bollente" | "caldo" | "tiepido" | "freddo" | "gelido";
export type PrioritaID = "Massima" | "Alta" | "Media" | "Bassa";

export interface TermometroID {
  /** 0-100. Un indice di qualificazione, non una probabilità di vendita. */
  score: number;
  /** `trapianto` = percorso a parte, senza grado di vendita. */
  temperatura: GradoID | "trapianto";
  priorita: PrioritaID | "A parte";
  motivazione: string;
  segnali_positivi: string[];
  ostacoli: string[];
  contraddizioni: string[];
  azione_consigliata: string;
  /** I tetti applicati, nell'ordine: servono a capire perché non è più su. */
  limiti: string[];
  /** Le risposte brevi da scrivere accanto al pallino (le più utili prima). */
  brevi: string[];
}

/** I campi che il termometro legge. Le chiavi sono quelle di RisposteModulo. */
type Risposte = Pick<
  RisposteModulo,
  | "soluzione"
  | "roma"
  | "cerca"
  | "dubbio"
  | "inizio"
  | "budget"
  | "aspettativa"
  | "scelta"
  | "budgetLibero"
>;

export const BASE = 25;

/** ── LA TABELLA DEI PESI ───────────────────────────────────────────────────
 *  Il perché di ogni numero sta accanto. In sintesi: urgenza e budget pesano
 *  di più (sono la prontezza e l'idoneità), Roma è un requisito (pesa, e in
 *  più ha il suo tetto), «cosa cerchi» e «dubbio» pesano poco perché dicono
 *  le obiezioni, non la voglia di comprare. */
export const PESI: Record<string, Record<string, number>> = {
  //  Idoneità logistica: il percorso si fa a Roma. Pesa, e il «no» ha il tetto.
  roma: { si: 12, no: -10 },
  //  «Il meglio» si allinea al posizionamento, ma NON dice che può spendere:
  //  poco. «Economica» non è un difetto: zero.
  cerca: { meglio: 4, economica: 0 },
  //  Un dubbio è un'obiezione da preparare, non disinteresse: risultato e
  //  tenuta valgono zero. Il costo è l'unico che anticipa un ostacolo vero.
  dubbio: { risultato: 0, tenuta: 0, costo: -3 },
  //  Prontezza: è il segnale più forte, insieme al budget.
  inizio: { subito: 20, trenta: 15, info: -5 },
  //  Idoneità economica. «Approfondire» non è un no: un po' di punti.
  budget: { si: 20, approfondire: 6, no: -15 },
  //  Intenzione: chi vuole capire come iniziare è già oltre la curiosità.
  aspettativa: { adatto: 12, confronto: 5, futuro: -8 },
  //  Maturità della scelta. ⚠️ «Prima consulenza» NON è peggio: +5, perché
  //  vuole iniziare. Chi ha preventivi è più avanti: +10.
  scelta: { preventivi: 10, confronto: 7, nessuna: 5 },
};

/** Le soglie, dalla più calda. */
const SOGLIE: [GradoID, number][] = [
  ["bollente", 80],
  ["caldo", 60],
  ["tiepido", 45],
  ["freddo", 25],
  ["gelido", 0],
];
/** Il punteggio più alto di ogni grado: serve a tagliare il numero al tetto. */
const MASSIMO: Record<GradoID, number> = {
  bollente: 100,
  caldo: 79,
  tiepido: 59,
  freddo: 44,
  gelido: 24,
};
const ORDINE: GradoID[] = ["gelido", "freddo", "tiepido", "caldo", "bollente"];
const PRIORITA: Record<GradoID, PrioritaID> = {
  bollente: "Massima",
  caldo: "Alta",
  tiepido: "Media",
  freddo: "Bassa",
  gelido: "Bassa",
};
export const PAROLA_ID: Record<GradoID, string> = {
  bollente: "Bollente",
  caldo: "Caldo",
  tiepido: "Tiepido",
  freddo: "Freddo",
  gelido: "Gelido",
};

const gradoDi = (score: number): GradoID => SOGLIE.find(([, s]) => score >= s)?.[0] ?? "gelido";
const piuBasso = (a: GradoID, b: GradoID): GradoID =>
  ORDINE.indexOf(a) <= ORDINE.indexOf(b) ? a : b;

/** La cifra più alta scritta nel budget a mano («300-400 euro» → 400). */
export function cifraDelBudget(t?: string): number | undefined {
  const numeri = String(t ?? "")
    .replace(/(\d)[.\s](\d{3})\b/g, "$1$2")
    .match(/\d+(?:[.,]\d+)?/g);
  if (!numeri) return undefined;
  const v = Math.max(...numeri.map((n) => Number(n.replace(",", "."))));
  return Number.isFinite(v) ? v : undefined;
}

/** Il modulo «22-ott» ha risposto almeno a una domanda che conosciamo? */
export function haTermometroID(m?: RisposteModulo | null): boolean {
  if (!m) return false;
  if (m.soluzione === "trapianto") return true;
  return Object.keys(PESI).some((c) => {
    const id = m[c as keyof Risposte] as string | undefined;
    return !!id && PESI[c][id] !== undefined;
  });
}

/** ── IL CALCOLO ────────────────────────────────────────────────────────────
 *  `answers` sono gli id di RisposteModulo (vedi crm/modulo-lead):
 *  { soluzione, roma, cerca, dubbio, inizio, budget, aspettativa, scelta,
 *    budgetLibero }. Un campo che manca è una domanda non raccolta. */
export function calculateLeadTemperature(answers: Risposte): TermometroID {
  const a: Risposte = { ...answers };
  const segnali: string[] = [];
  const ostacoli: string[] = [];
  const contraddizioni: string[] = [];
  const limiti: string[] = [];
  const brevi: string[] = [];

  //  0. Il trapianto è un altro mestiere.
  if (a.soluzione === "trapianto")
    return {
      score: 0,
      temperatura: "trapianto",
      priorita: "A parte",
      motivazione:
        "Valuta il trapianto chirurgico: percorso separato, non è un lead Invisible Derm.",
      segnali_positivi: [],
      ostacoli: [],
      contraddizioni: [],
      azione_consigliata:
        "Gestire nel percorso trapianto (E3); proporre Invisible Derm solo se chiede alternative.",
      limiti: ["Trapianto: nessuna temperatura di vendita"],
      brevi: ["valuta il trapianto"],
    };

  //  Q9: il budget scritto a mano può riaprire la porta.
  let budget = a.budget;
  let riaperto = false;
  const cifra = cifraDelBudget(a.budgetLibero);
  if (budget === "no" && cifra !== undefined && cifra >= 589) {
    contraddizioni.push(
      `Dice che 589€ è fuori budget ma indica ${cifra}€: il budget va verificato a voce`,
    );
    budget = "approfondire";
    riaperto = true;
  }

  //  1. I punti.
  let score = BASE;
  for (const campo of Object.keys(PESI)) {
    const id = campo === "budget" ? budget : (a[campo as keyof Risposte] as string | undefined);
    if (id && PESI[campo][id] !== undefined) score += PESI[campo][id];
  }

  //  I segnali e gli ostacoli, detti come li direbbe un commerciale.
  if (a.roma === "si") segnali.push("Disponibile a venire a Roma");
  if (a.roma === "no") ostacoli.push("Barriera logistica: al momento non può venire a Roma");
  if (budget === "si") segnali.push("Budget compatibile con i 589€");
  if (budget === "approfondire") ostacoli.push("Budget da verificare: vuole prima approfondire");
  if (budget === "no")
    ostacoli.push(
      cifra !== undefined
        ? `Budget insufficiente: indica ${cifra}€, sotto i 589€`
        : "Budget insufficiente per il percorso da 589€",
    );
  if (a.inizio === "subito") segnali.push("Vuole iniziare il prima possibile");
  if (a.inizio === "trenta") segnali.push("Vuole iniziare entro 30 giorni");
  if (a.inizio === "info") ostacoli.push("Nessuna urgenza: sta solo cercando informazioni");
  if (a.aspettativa === "adatto") segnali.push("Vuole capire se fa per lui e come iniziare");
  if (a.aspettativa === "confronto") segnali.push("Vuole confrontarlo con altre soluzioni");
  if (a.aspettativa === "futuro")
    ostacoli.push("Dalla consulenza vuole informazioni per il futuro");
  if (a.scelta === "preventivi") segnali.push("Ha già preventivi: cerca la soluzione giusta");
  if (a.scelta === "confronto") segnali.push("Ha già visto altri centri: sta confrontando");
  if (a.scelta === "nessuna") segnali.push("Prima consulenza, ma vuole iniziare");
  if (a.cerca === "meglio") segnali.push("Cerca il meglio: in linea col posizionamento");
  if (a.dubbio === "costo") ostacoli.push("Obiezione sul costo");

  //  2. Le contraddizioni.
  if ((a.inizio === "subito" || a.inizio === "trenta") && a.aspettativa === "futuro") {
    contraddizioni.push(
      "Dice di voler iniziare presto, ma dalla consulenza vuole informazioni per il futuro",
    );
    score -= 8;
  }
  //  Il prezzo: accetta i 589€ ma il dubbio è il costo. Se in più cerca
  //  «l'economico», il prezzo è il tema vero e il Bollente non si dà.
  const prezzoInContrasto = budget === "si" && a.dubbio === "costo";
  const prezzoTemaVero = prezzoInContrasto && a.cerca === "economica";
  if (prezzoTemaVero)
    contraddizioni.push(
      "Accetta i 589€ ma cerca l'economico e teme il costo: il prezzo è il tema vero",
    );
  else if (prezzoInContrasto)
    contraddizioni.push(
      "Il budget va bene, ma il dubbio principale è il costo: chiarire cosa intende",
    );
  if (a.inizio === "info" && (a.scelta === "preventivi" || a.scelta === "confronto"))
    contraddizioni.push("Ha già preventivi o altri centri, ma dice di cercare solo informazioni");

  //  3. I tetti. Vince il più basso.
  const tetti: { g: GradoID; perche: string; generale?: boolean }[] = [];
  const metti = (g: GradoID, perche: string, generale = false) =>
    tetti.push({ g, perche, generale });
  if (budget === "no") metti("freddo", "Budget insufficiente");
  if (a.roma === "no") metti("tiepido", "Non può venire a Roma");
  if (a.inizio === "info") metti("tiepido", "Sta solo cercando informazioni");
  if (a.aspettativa === "futuro") metti("tiepido", "Vuole informazioni per il futuro");
  if (prezzoTemaVero) metti("caldo", "Il prezzo è ancora il tema vero");
  //  Il budget riaperto dalla cifra di Q9 va verificato a voce prima di salire.
  if (riaperto) metti("tiepido", "Budget detto «no» e poi indicato sopra i 589€");

  //  4-5. Bollente e Caldo si guadagnano.
  const veloce = a.inizio === "subito" || a.inizio === "trenta";
  //  Che cosa manca, detto per nome: «non ha tutti i segnali» non aiuta chi
  //  telefona, «manca il budget sì» sì.
  const mancaPerBollente = [
    a.roma !== "si" && "Roma «sì»",
    budget !== "si" && "budget «sì»",
    !veloce && "inizio entro 30 giorni",
    a.aspettativa !== "adatto" && a.aspettativa !== "confronto" && "voler capire come iniziare",
  ].filter((x): x is string => !!x);
  if (mancaPerBollente.length)
    metti("caldo", `Per il Bollente manca: ${mancaPerBollente.join(", ")}`, true);
  const mancaPerCaldo = [
    a.roma !== "si" && "Roma «sì»",
    budget !== "si" && budget !== "approfondire" && "un budget non chiuso",
    !veloce && "inizio entro 30 giorni",
  ].filter((x): x is string => !!x);
  if (mancaPerCaldo.length)
    metti("tiepido", `Per il Caldo manca: ${mancaPerCaldo.join(", ")}`, true);

  score = Math.max(0, Math.min(100, score));
  const daiPunti = gradoDi(score);
  let grado = daiPunti;
  for (const t of tetti) grado = piuBasso(grado, t.g);
  score = Math.min(score, MASSIMO[grado]);
  //  Si scrivono solo i tetti che hanno abbassato davvero il grado: uno che
  //  non ha cambiato niente confonde chi legge.
  //  Le due regole generali (Bollente e Caldo si guadagnano) si scrivono
  //  solo se non c'è già un motivo preciso allo stesso livello o più in basso.
  const abbassano = tetti.filter((t) => ORDINE.indexOf(t.g) < ORDINE.indexOf(daiPunti));
  const precisi = abbassano.filter((t) => !t.generale);
  for (const t of abbassano)
    if (!t.generale || !precisi.some((p) => ORDINE.indexOf(p.g) <= ORDINE.indexOf(t.g)))
      limiti.push(`${t.perche} → al massimo ${PAROLA_ID[t.g]}`);

  //  Le brevi per la riga: prima i tempi e il budget, poi Roma.
  const BREVI_INIZIO: Record<string, string> = {
    subito: "inizia subito",
    trenta: "entro 30 giorni",
    info: "solo informazioni",
  };
  const BREVI_BUDGET: Record<string, string> = {
    si: "budget ok",
    approfondire: "budget da capire",
    no: "fuori budget",
  };
  if (a.inizio && BREVI_INIZIO[a.inizio]) brevi.push(BREVI_INIZIO[a.inizio]);
  if (a.budget && BREVI_BUDGET[budget ?? ""]) brevi.push(BREVI_BUDGET[budget ?? ""]);
  if (a.roma === "no") brevi.push("non viene a Roma");
  if (contraddizioni.length) brevi.push("risposte in contrasto");

  return {
    score,
    temperatura: grado,
    priorita: PRIORITA[grado],
    motivazione: motivazione(grado, segnali, ostacoli, contraddizioni),
    segnali_positivi: segnali,
    ostacoli,
    contraddizioni,
    azione_consigliata: azione(grado, a, budget),
    limiti,
    brevi,
  };
}

function motivazione(g: GradoID, s: string[], o: string[], c: string[]): string {
  const primo = (x: string[]) => (x[0] ? x[0].charAt(0).toLowerCase() + x[0].slice(1) : "");
  if (g === "bollente")
    return `Segnali coerenti: ${s
      .slice(0, 3)
      .map((x) => x.toLowerCase())
      .join(", ")}.`;
  if (c.length && g !== "gelido") return `${PAROLA_ID[g]}: ${primo(c)}.`;
  if (o.length)
    return `${PAROLA_ID[g]} perché ${primo(o)}${s.length ? `, anche se ${primo(s)}` : ""}.`;
  if (s.length) return `${PAROLA_ID[g]}: ${primo(s)}, ma mancano segnali per salire.`;
  return `${PAROLA_ID[g]}: poche risposte per dire di più.`;
}

function azione(g: GradoID, a: Risposte, budget?: string): string {
  const DUBBIO: Record<string, string> = {
    risultato: "mostrare prima/dopo e risultati veri",
    tenuta: "spiegare tenuta e manutenzione",
    costo: "spiegare cosa comprende il prezzo",
  };
  const suDubbio = a.dubbio && DUBBIO[a.dubbio] ? `; ${DUBBIO[a.dubbio]}` : "";
  switch (g) {
    case "bollente":
      return `Contatto prioritario oggi (chiamata o WhatsApp) per fissare la consulenza${suDubbio}.`;
    case "caldo":
      return budget === "approfondire"
        ? `Contatto entro 24 ore: verificare il budget e fissare la consulenza${suDubbio}.`
        : `Contatto entro 24 ore per fissare la consulenza${suDubbio}.`;
    case "tiepido":
      if (a.roma === "no")
        return "Consulenza online per informare; verificare se e quando può venire a Roma.";
      return "Nurturing informativo (risultati, tenuta, casi veri) e richiamo fra 2-3 settimane.";
    case "freddo":
      return budget === "no"
        ? "Verificare il budget; proporre solo se c'è un'offerta compatibile."
        : "Nurturing leggero: messaggi informativi, nessuna chiamata prioritaria.";
    default:
      return "Nessuna chiamata prioritaria: solo messaggi informativi.";
  }
}

/** ── COME CALIBRARE I PESI COI RISULTATI VERI ─────────────────────────────
 *  Quando ci saranno almeno 150-200 lead del modulo con l'esito (consulenza
 *  prenotata, svolta, venduta):
 *   1. per ogni risposta, il tasso di vendita di chi l'ha data contro chi no
 *      (con almeno 20 lead per risposta, altrimenti non si tocca);
 *   2. una regressione logistica semplice sulle risposte → probabilità di
 *      vendita; i coefficienti diventano i nuovi PESI (riscalati su 100);
 *   3. le soglie si rimettono perché Bollente raccolga circa il 15-20% dei
 *      lead e la metà delle vendite;
 *   4. i tetti (budget, Roma, informazioni) restano: sono regole di
 *      commercio, non numeri da stimare.
 *  ───────────────────────────────────────────────────────────────────────── */
