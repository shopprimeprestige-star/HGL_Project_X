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
 *  ⚠️ NON IMPORTA importa/chi-chiamare: è chi-chiamare che importa questo
 *   file. Al contrario si farebbe un giro di import.
 *  ───────────────────────────────────────────────────────────────────────── */
import { eChiusuraVinta } from "@/crm/types";
import type { LeadData, LeadStatus, QualificaInfo, RisposteModulo } from "@/crm/types";
import { etichettaRisposta, moduloLetto } from "@/crm/modulo-lead";

export type LivelloTemperatura = "caldo" | "medio" | "freddo" | "nessuna";

export interface TemperaturaLead {
  livello: LivelloTemperatura;
  /** "Caldo" | "Medio" | "Freddo" | "" */
  parola: string;
  /** una frase: la risposta che ha deciso il livello. "" se nessuna */
  perche: string;
  /** da dove viene: il modulo dell'inserzione, il quiz del sito, o niente */
  fonte: "modulo" | "sito" | null;
}

const PAROLA: Record<LivelloTemperatura, string> = {
  caldo: "Caldo",
  medio: "Medio",
  freddo: "Freddo",
  nessuna: "",
};

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
  return { livello: "caldo", testo: `ha provato: ${etichettaRisposta("giaFatto", id).toLowerCase()}` };
}

/** Le risposte di temperatura del modulo, nell'ordine in cui si leggono:
 *  urgenza → già provato → fastidio. Solo quelle conosciute. */
function vociDelModulo(m?: RisposteModulo): { livello: LivelloTemperatura; testo: string }[] {
  if (!m) return [];
  return [URGENZA[m.urgenza ?? ""], giaProvato(m.giaFatto), FASTIDIO[m.fastidio ?? ""]].filter(
    (v): v is { livello: LivelloTemperatura; testo: string } => !!v,
  );
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
  const dalModulo = decidi(vociDelModulo(m));
  if (dalModulo)
    return { livello: dalModulo.livello, parola: PAROLA[dalModulo.livello], perche: dalModulo.testo, fonte: "modulo" };
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
  const modulo = vociDelModulo(m);
  const voci = modulo.length ? modulo : vociDelQuiz(q);
  return voci.slice(0, Math.max(0, max)).map((v) => v.testo);
}

/** Dopo la vendita la temperatura è storia vecchia: sulle righe sarebbe rumore. */
export function mostraTemperatura(stato?: LeadStatus | string | null): boolean {
  return !eChiusuraVinta(stato);
}

/** Comodità per i componenti: `moduloLetto(d)` + `qualifica`, una volta sola. */
export function temperaturaDi(d?: Partial<LeadData> | null): { t: TemperaturaLead; brevi: string[] } {
  const m = moduloLetto(d);
  const q = d?.qualifica;
  return { t: temperaturaLead(m, q), brevi: risposteBrevi(m, q) };
}
