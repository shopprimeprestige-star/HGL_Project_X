/** ── COM'È MESSO IL CLIENTE: CALDO, MEDIO, FREDDO ──────────────────────────
 *
 *  Richiesta del titolare (14/10/2026): il consulente in «Oggi» deve capire
 *  dalla riga com'è messo il cliente (ha fretta? ha già provato altro?) senza
 *  aprire la scheda una per una. Prima esisteva solo «caldo», e solo in Lead
 *  importati (`eCaldo` in importa/chi-chiamare).
 *
 *  ⚠️ UNA REGOLA SOLA, SCRITTA QUI. «Oggi», Lead importati e la scheda del
 *   lead leggono tutti da `temperaturaLead`: lo stesso lead ha lo stesso
 *   livello dappertutto. `eCaldo` è diventato un suo caso
 *   (`livello === "caldo"`), così la coda della setter non cambia.
 *
 *  ── LA REGOLA (sulle risposte già lette con `moduloLetto`) ────────────────
 *   CALDO   vuole risolvere subito, OPPURE ha già provato qualcosa (non
 *           «niente»). È il caldo stretto del titolare (14/10), uguale a prima.
 *   MEDIO   non caldo, e fastidio «molto»/«abbastanza» OPPURE «lo sta
 *           valutando sul serio».
 *   FREDDO  ha risposto ad almeno una domanda di temperatura (fastidio, già
 *           provato, come vive il problema) con una risposta conosciuta, ma
 *           nessuna delle sopra.
 *   NESSUNA nessun modulo, o solo zona / orario / problema / ci conosce.
 *
 *  ⚠️ UNA VOCE SBAGLIATA È PEGGIO DI UNA MANCANTE. Chi ha detto solo «Nord
 *   Italia, di mattina» non ci ha detto niente sulla voglia di risolvere:
 *   chiamarlo freddo sarebbe un giudizio inventato. Per lo stesso motivo un
 *   valore che non conosciamo (`fastidio: "boh"`) non fa freddo, fa nessuna.
 *   Unica eccezione voluta: un «già provato» diverso da «niente» è caldo
 *   anche se sconosciuto, perché così faceva `eCaldo` e la coda non si sposta.
 *  ⚠️ «CI SEGUE GIÀ» NON SCALDA. Il titolare ha appena stretto il caldo per
 *   farlo distinguere: allargare il medio con un criterio in più rifà lo
 *   stesso errore.
 *
 *  ── IL RIPIEGO: IL QUIZ DEL SITO ──────────────────────────────────────────
 *   Il modulo vince. Solo se dal modulo esce «nessuna» si legge `qualifica`
 *   (il quiz del sito: disagio 1-10 e quanto è urgente):
 *     Caldo  urgenza subito | si | convince
 *     Medio  disagio 7 o più, oppure urgenza 1mese | valuto | valutando
 *     Freddo disagio da 1 a 6, oppure urgenza 2_3mesi
 *   I `painPoints` da soli non dicono niente sulla temperatura.
 *   ⚠️ «Sto valutando diverse opzioni» (`valuto`) è Medio, come da SPEC; il
 *    vecchio heat-utils lo chiamava freddo. Segnalato al titolare.
 *
 *  ── IL MODULO «589€»: SEI LIVELLI (richiesta del titolare, 20/10/2026) ──
 *   Quando il lead ha risposto alle domande del modulo «589€» (da quanto,
 *   quando vuole risolvere, quanto gli pesa, prezzo, decide da solo, motivo)
 *   la classifica è a sei livelli, con i punti di `PUNTI_589`:
 *     Caldissimo ≥ 90% · Caldo ≥ 78% · Fuochino ≥ 58% · Medio ≥ 38%
 *     Freddo ≥ 18% · Freddissimo sotto, o «no» al prezzo.
 *   La percentuale è sui punti delle domande a cui ha RISPOSTO: il modulo del
 *   20/10 non ha «quanto ti pesa», quello del 21/10 sì, e una domanda che non
 *   c'era non deve abbassare nessuno.
 *   Gli altri moduli restano a tre livelli, con la regola qui sopra.
 *   ⚠️ «Caldo» per la coda (`eCaldo`) vale anche per Caldissimo.
 *
 *  ── IL MODULO «22-OTT» DI INVISIBLE DERM: CINQUE GRADI (22/10/2026) ───
 *   Bollente · Caldo · Tiepido · Freddo · Gelido, con punteggio 0-100, tetti
 *   e contraddizioni: la regola sta in crm/termometro-id. Vince su tutte le
 *   altre quando il lead ha risposto a quel modulo. Chi valuta il trapianto
 *   ha il suo grado, «Trapianto», che non è una temperatura di vendita.
 *   ⚠️ «Caldo» per la coda (`eCaldo`) vale anche per Bollente.
 *
 *  ⚠️ NON IMPORTA importa/chi-chiamare: è chi-chiamare che importa questo
 *   file. Al contrario si farebbe un giro di import.
 *  ───────────────────────────────────────────────────────────────────────── */
import { eChiusuraVinta } from "@/crm/types";
import type { LeadData, LeadStatus, QualificaInfo, RisposteModulo } from "@/crm/types";
import { CAMPI_589, etichettaRisposta, moduloLetto } from "@/crm/modulo-lead";
import {
  PAROLA_ID,
  calculateLeadTemperature,
  haTermometroID,
  type TermometroID,
} from "@/crm/termometro-id";

export type LivelloTemperatura =
  //  Il modulo «22-ott» (crm/termometro-id).
  | "bollente"
  | "tiepido"
  | "gelido"
  | "trapianto"
  | "caldissimo"
  | "caldo"
  | "fuochino"
  | "medio"
  | "freddo"
  | "freddissimo"
  | "nessuna";

export interface TemperaturaLead {
  livello: LivelloTemperatura;
  /** "Caldissimo" | "Caldo" | "Fuochino" | "Medio" | "Freddo" | "Freddissimo" | "" */
  parola: string;
  /** una frase: la risposta che ha deciso il livello. "" se nessuna */
  perche: string;
  /** da dove viene: il modulo dell'inserzione, il quiz del sito, o niente */
  fonte: "modulo" | "sito" | null;
  /** Solo col modulo «589€»: i punti presi su quelli possibili. */
  punti?: { presi: number; su: number };
  /** Solo col modulo «22-ott»: il risultato intero (segnali, ostacoli,
   *  contraddizioni, azione consigliata). */
  termometro?: TermometroID;
}

const PAROLA: Record<LivelloTemperatura, string> = {
  ...PAROLA_ID,
  trapianto: "Trapianto",
  caldissimo: "Caldissimo",
  caldo: "Caldo",
  fuochino: "Fuochino",
  medio: "Medio",
  freddo: "Freddo",
  freddissimo: "Freddissimo",
  nessuna: "",
};

/** Caldissimo e Caldo sono entrambi «caldo» per la coda della setter. */
export const eLivelloCaldo = (l: LivelloTemperatura): boolean =>
  l === "bollente" || l === "caldissimo" || l === "caldo";

const NESSUNA: TemperaturaLead = { livello: "nessuna", parola: "", perche: "", fonte: null };

/* ── IL MODULO DELL'INSERZIONE ─────────────────────────────────────────── */

const URGENZA: Record<string, { livello: LivelloTemperatura; testo: string }> = {
  subito: { livello: "caldo", testo: "vuole risolvere ora" },
  valutando: { livello: "medio", testo: "valuta sul serio" },
  informativo: { livello: "freddo", testo: "si sta informando" },
};

const FASTIDIO: Record<string, { livello: LivelloTemperatura; testo: string }> = {
  molto: { livello: "medio", testo: "fastidio: molto" },
  abbastanza: { livello: "medio", testo: "fastidio: abbastanza" },
  poco: { livello: "freddo", testo: "fastidio: poco" },
  perNiente: { livello: "freddo", testo: "fastidio: per niente" },
};

/** «Già provato»: «niente» è freddo; qualunque altra risposta è caldo (vedi
 *  il cartello in testa: è la regola di sempre di `eCaldo`). */
function giaProvato(id?: string): { livello: LivelloTemperatura; testo: string } | undefined {
  if (!id) return undefined;
  if (id === "niente") return { livello: "freddo", testo: "mai provato nulla" };
  return {
    livello: "caldo",
    testo: `ha provato: ${etichettaRisposta("giaFatto", id).toLowerCase()}`,
  };
}

/** Le risposte di temperatura del modulo, nell'ordine in cui si leggono:
 *  urgenza → già provato → fastidio. Solo quelle conosciute. */
function vociDelModulo(m?: RisposteModulo): { livello: LivelloTemperatura; testo: string }[] {
  if (!m) return [];
  return [URGENZA[m.urgenza ?? ""], giaProvato(m.giaFatto), FASTIDIO[m.fastidio ?? ""]].filter(
    (v): v is { livello: LivelloTemperatura; testo: string } => !!v,
  );
}

/* ── IL MODULO «589€» ──────────────────────────────────────────────────── */

/** Punti per risposta. Il massimo di ogni domanda è il valore più alto. */
export const PUNTI_589: Record<string, Record<string, number>> = {
  urgenza: { subito: 3, valutando: 2, informativo: 0 },
  durata: { oltreTre: 2, unoTre: 1, meno1: 0 },
  tempi: { trenta: 3, mesi: 2, valuta: 0 },
  peso: { tantissimo: 2, molto: 1, abbastanza: 0, poco: 0 },
  prezzo: { si: 3, dipende: 1, no: 0 },
  decide: { solo: 2, coppia: 0 },
  motivo: { evento: 2, relazione: 2, lavoro: 2, stufo: 1, curiosita: 0 },
};

/** Le soglie, dalla più calda: la prima che la percentuale raggiunge. */
const SOGLIE_589: [LivelloTemperatura, number][] = [
  ["caldissimo", 0.9],
  ["caldo", 0.78],
  ["fuochino", 0.58],
  ["medio", 0.38],
  ["freddo", 0.18],
];

const TESTO_589: Record<string, Record<string, string>> = {
  tempi: { trenta: "entro 30 giorni", mesi: "entro 1-3 mesi", valuta: "sta solo valutando" },
  prezzo: { si: "prezzo ok", dipende: "prezzo: dipende", no: "prezzo: no" },
  urgenza: {
    subito: "lo vive come grave",
    valutando: "valuta sul serio",
    informativo: "si sta informando",
  },
  decide: { solo: "decide da solo", coppia: "ne parla in famiglia" },
  peso: {
    tantissimo: "gli pesa 9-10",
    molto: "gli pesa 7-8",
    abbastanza: "gli pesa 4-6",
    poco: "gli pesa 1-3",
  },
  motivo: {
    evento: "ha un evento",
    relazione: "nuova relazione",
    lavoro: "per lavoro",
    stufo: "è stufo",
    curiosita: "per curiosità",
  },
  durata: { oltreTre: "da più di 3 anni", unoTre: "da 1-3 anni", meno1: "da meno di 1 anno" },
};

/** La classifica a sei livelli, se il lead ha risposto al modulo «589€».
 *  `undefined` altrimenti: decide la regola a tre livelli. */
export function classifica589(
  m?: RisposteModulo,
): { livello: LivelloTemperatura; presi: number; su: number; brevi: string[] } | undefined {
  if (!m || !CAMPI_589.some((c) => m[c] && PUNTI_589[c][m[c] as string] !== undefined))
    return undefined;
  let presi = 0;
  let su = 0;
  //  Le risposte brevi nell'ordine in cui servono al telefono: prima i tempi e
  //  il prezzo, poi il resto.
  const brevi: string[] = [];
  for (const campo of ["tempi", "prezzo", "urgenza", "decide", "peso", "motivo", "durata"]) {
    const id = m[campo as keyof RisposteModulo] as string | undefined;
    const tabella = PUNTI_589[campo];
    if (!id || tabella[id] === undefined) continue;
    presi += tabella[id];
    su += Math.max(...Object.values(tabella));
    const t = TESTO_589[campo]?.[id];
    if (t) brevi.push(t);
  }
  //  «No» al prezzo chiude la porta, qualunque cosa dica il resto.
  if (m.prezzo === "no") return { livello: "freddissimo", presi, su, brevi };
  const quota = su ? presi / su : 0;
  const livello = SOGLIE_589.find(([, soglia]) => quota >= soglia - 1e-9)?.[0] ?? "freddissimo";
  return { livello, presi, su, brevi };
}

/* ── IL MODULO «22-OTT» ────────────────────────────────────────────────── */

/** Il termometro Invisible Derm, se il lead ha risposto a quel modulo. */
export function termometroDi(m?: RisposteModulo): TermometroID | undefined {
  return m && haTermometroID(m) ? calculateLeadTemperature(m) : undefined;
}

/* ── IL QUIZ DEL SITO ──────────────────────────────────────────────────── */

const URGENZA_QUIZ: Record<string, { livello: LivelloTemperatura; testo: string }> = {
  subito: { livello: "caldo", testo: "vuole risolvere subito" },
  si: { livello: "caldo", testo: "è pronto" },
  convince: { livello: "caldo", testo: "parte se convinto" },
  "1mese": { livello: "medio", testo: "entro 1 mese" },
  valuto: { livello: "medio", testo: "sta valutando" },
  valutando: { livello: "medio", testo: "sta valutando" },
  "2_3mesi": { livello: "freddo", testo: "tra 2-3 mesi" },
};

/** Il disagio da 1 a 10. Nell'archivio può essere salvato come testo ("8"). */
function disagioDi(q?: QualificaInfo | null): number | undefined {
  const n = Number(q?.disagio);
  return Number.isInteger(n) && n >= 1 && n <= 10 ? n : undefined;
}

/** Le risposte di temperatura del quiz: urgenza → disagio. */
function vociDelQuiz(q?: QualificaInfo | null): { livello: LivelloTemperatura; testo: string }[] {
  if (!q) return [];
  const voci: { livello: LivelloTemperatura; testo: string }[] = [];
  const u = URGENZA_QUIZ[String(q.urgenza ?? "")];
  if (u) voci.push(u);
  const d = disagioDi(q);
  if (d != null) voci.push({ livello: d >= 7 ? "medio" : "freddo", testo: `disagio ${d}/10` });
  return voci;
}

/* ── LA DECISIONE ──────────────────────────────────────────────────────── */

const ORDINE: LivelloTemperatura[] = ["caldo", "medio", "freddo"];

/** Il livello più alto fra le voci, e la prima voce che lo dà (il perché). */
function decidi(voci: { livello: LivelloTemperatura; testo: string }[]) {
  for (const livello of ORDINE) {
    const v = voci.find((x) => x.livello === livello);
    if (v) return { livello, testo: v.testo };
  }
  return undefined;
}

/** La temperatura del lead: prima il modulo, poi (se il modulo tace) il quiz. */
export function temperaturaLead(m?: RisposteModulo, q?: QualificaInfo | null): TemperaturaLead {
  const id = termometroDi(m);
  if (id)
    return {
      livello: id.temperatura,
      parola: PAROLA[id.temperatura],
      perche:
        id.temperatura === "trapianto"
          ? "percorso trapianto, a parte"
          : `${id.score}/100 · priorità ${id.priorita.toLowerCase()}`,
      fonte: "modulo",
      termometro: id,
    };
  const sei = classifica589(m);
  if (sei)
    return {
      livello: sei.livello,
      parola: PAROLA[sei.livello],
      perche: `${sei.presi} punti su ${sei.su}${sei.brevi.length ? ` · ${sei.brevi.slice(0, 2).join(" · ")}` : ""}`,
      fonte: "modulo",
      punti: { presi: sei.presi, su: sei.su },
    };
  const dalModulo = decidi(vociDelModulo(m));
  if (dalModulo)
    return {
      livello: dalModulo.livello,
      parola: PAROLA[dalModulo.livello],
      perche: dalModulo.testo,
      fonte: "modulo",
    };
  const dalQuiz = decidi(vociDelQuiz(q));
  if (dalQuiz)
    return {
      livello: dalQuiz.livello,
      parola: PAROLA[dalQuiz.livello],
      perche: `dal quiz del sito: ${dalQuiz.testo}`,
      fonte: "sito",
    };
  return { ...NESSUNA };
}

/** Le risposte brevi da scrivere accanto al pallino, al massimo `max`.
 *  Se il modulo dice qualcosa sulla temperatura vengono solo dal modulo
 *  (mescolarle col quiz darebbe due voci che si contraddicono). */
export function risposteBrevi(m?: RisposteModulo, q?: QualificaInfo | null, max = 2): string[] {
  const id = termometroDi(m);
  if (id) return id.brevi.slice(0, Math.max(0, max));
  const sei = classifica589(m);
  if (sei) return sei.brevi.slice(0, Math.max(0, max));
  const modulo = vociDelModulo(m);
  const voci = modulo.length ? modulo : vociDelQuiz(q);
  return voci.slice(0, Math.max(0, max)).map((v) => v.testo);
}

/** Dopo la vendita la temperatura è storia vecchia: sulle righe sarebbe rumore. */
export function mostraTemperatura(stato?: LeadStatus | string | null): boolean {
  return !eChiusuraVinta(stato);
}

/** Comodità per i componenti: `moduloLetto(d)` + `qualifica`, una volta sola.
 *  `max` = quante risposte brevi (di serie 2, come sulle righe). */
export function temperaturaDi(
  d?: Partial<LeadData> | null,
  max = 2,
): { t: TemperaturaLead; brevi: string[] } {
  const m = moduloLetto(d);
  const q = d?.qualifica;
  return { t: temperaturaLead(m, q), brevi: risposteBrevi(m, q, max) };
}
