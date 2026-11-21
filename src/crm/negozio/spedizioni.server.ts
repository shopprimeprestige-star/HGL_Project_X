/** ── LE SPEDIZIONI: IL SERVER DEL CRM (spedizioni.server.ts) ─────────────────
 *  Commessa 2026-11-20-shop-completo, R2 · T50 (PIANO-R2 D51, D55, §3.5). Porte come `interruttori.server.ts`.
 *
 *  GET  ?spedizioni                          → `{ ok, tariffa, corrieri, storico }`
 *  POST { azione: "tariffa_salva", id, atteso, nome, corriere, costoCent, giorniMin, giorniMax, attiva }
 *  POST { azione: "tariffa_conferma", id, atteso }                    («Conferma la tariffa»: toglie `provvisoria`)
 *  POST { azione: "corrieri_salva", corrieri: [{ nome, modello }], atteso: <l'elenco che vedevi> }
 *
 *  ── LE REGOLE ───────────────────────────────────────────────────────────────
 *  · Si scrive SOLO con `rpc`: `shop_tariffa_imposta` (la tariffa) e `shop_impostazione_imposta` (i corrieri). La tabella
 *    `shop_spedizioni_tariffe` per `service_role` è in sola lettura (S5). Lo storico lo scrive il database, nella stessa transazione.
 *  · `atteso` è la versione che la schermata aveva davanti (`aggiornatoIl` della tariffa, l'elenco dei corrieri): se non è più
 *    quella → 409 con il valore vero. Tutti i controlli dei valori vengono PRIMA di qualunque chiamata al database.
 *  · Costo in centesimi interi 0..99900; tempi 1..60 giorni lavorativi, TUTTI E DUE o nessuno, minimo <= massimo
 *    (il database ha solo «>= 1»: il resto lo impone questo file). Soglia «gratis da» non gestita (D51).
 *  · Corrieri: al massimo 20, nome 1..40 senza doppioni, modello di link vuoto oppure `https://` con `{numero}` (la regola è
 *    quella di `corriereLink` di T45: un solo controllo, quello che userà la pagina ordine).
 *  · «Conferma» azzera `provvisoria` e scrive `confermata_il` (lo fa la funzione SQL). Dopo «Salva» su una tariffa GIÀ
 *    confermata la risposta porta un `avviso`: la modifica è subito visibile ai clienti.
 *  · Tabella assente → `{ ok:false, motivo:"migrazione" }`. Nel log solo codici. */
import { corriereLink, leggiSpedizione } from "../../shop/cassa/spedizione";
import {
  azioneDi,
  codiceDi,
  conflitto,
  dati,
  eMancante,
  eOggetto,
  eUuid,
  gestisci,
  guasto,
  leggiCorpo,
  rifiuta,
  righe,
  senzaMigrazione,
  stessoIstante,
  type EsitoDb,
  type PorteDb,
} from "./comune";

export const AZIONI_SPEDIZIONI = ["tariffa_salva", "tariffa_conferma", "corrieri_salva"] as const;

const COSTO_MAX_CENT = 99_900;
const GIORNI_MIN = 1;
const GIORNI_MAX = 60;
const NOME_TARIFFA_MAX = 80;
const CORRIERE_TARIFFA_MAX = 40;
const MAX_CORRIERI = 20;
const NOME_CORRIERE_MAX = 40;
const MODELLO_MAX = 300;
const COLONNE =
  "id, paese, nome, corriere, costo_cent, giorni_min, giorni_max, attiva, provvisoria, confermata_il, creato_il, aggiornato_il";
const FRASE_VERSIONE =
  "Un'altra persona ha cambiato la spedizione nel frattempo: ricarica la pagina e rifai la modifica.";

export type Corriere = { nome: string; modello: string };

/* ══ I CONTROLLI DEI VALORI (prima del database) ═════════════════════════════ */

// eslint-disable-next-line no-control-regex -- i caratteri di controllo sono proprio ciò che si cerca
const CONTROLLO = /[\u0000-\u001f\u007f]/;
/** Un testo breve: stringa, senza caratteri di controllo, tolti gli spazi ai bordi, al massimo `max` segni. */
function testoBreve(x: unknown, max: number, frase: string, ammettiVuoto = false): string {
  if (typeof x !== "string" || x.length > max * 2 || CONTROLLO.test(x))
    throw rifiuta("valore", 400, frase);
  const t = x.trim();
  if (t.length > max || (!t && !ammettiVuoto)) throw rifiuta("valore", 400, frase);
  return t;
}
const interoIn = (x: unknown, da: number, a: number): x is number =>
  typeof x === "number" && Number.isSafeInteger(x) && x >= da && x <= a;

/** La versione vista: una data che si legge. */
function versioneVista(x: unknown): string {
  if (typeof x !== "string" || Number.isNaN(Date.parse(x)))
    throw rifiuta(
      "valore",
      400,
      "Manca la versione che vedevi prima del cambio: ricarica la pagina.",
    );
  return x;
}
function idTariffa(x: unknown): string {
  if (typeof x !== "string" || !eUuid(x))
    throw rifiuta("valore", 400, "Questa tariffa non è valida: ricarica la pagina.");
  return x;
}

/** I campi di «Salva», già controllati, con i nomi delle colonne. */
function campiTariffa(corpo: Record<string, unknown>) {
  const nome = testoBreve(
    corpo.nome,
    NOME_TARIFFA_MAX,
    `Il nome della tariffa è obbligatorio e può avere al massimo ${NOME_TARIFFA_MAX} caratteri.`,
  );
  const corriere =
    testoBreve(
      corpo.corriere ?? "",
      CORRIERE_TARIFFA_MAX,
      `Il corriere può avere al massimo ${CORRIERE_TARIFFA_MAX} caratteri.`,
      true,
    ) || null;
  if (!interoIn(corpo.costoCent, 0, COSTO_MAX_CENT))
    throw rifiuta(
      "valore",
      400,
      `Il costo è un importo in centesimi, intero, da 0 a ${COSTO_MAX_CENT} (999 €).`,
    );
  const { giorniMin: min, giorniMax: max } = corpo;
  const tempiFrase = `I giorni di consegna vanno da ${GIORNI_MIN} a ${GIORNI_MAX}, interi, con il minimo non oltre il massimo; scrivili tutti e due oppure lasciali vuoti.`;
  let giorni_min: number | null = null,
    giorni_max: number | null = null;
  if (min != null || max != null) {
    if (
      !interoIn(min, GIORNI_MIN, GIORNI_MAX) ||
      !interoIn(max, GIORNI_MIN, GIORNI_MAX) ||
      min > max
    )
      throw rifiuta("valore", 400, tempiFrase);
    giorni_min = min;
    giorni_max = max;
  }
  if (typeof corpo.attiva !== "boolean")
    throw rifiuta("valore", 400, "Dì se la tariffa è attiva o spenta.");
  return {
    nome,
    corriere,
    costo_cent: corpo.costoCent,
    giorni_min,
    giorni_max,
    attiva: corpo.attiva,
  };
}

/** L'elenco dei corrieri: ognuno `{nome, modello}`, niente altro. */
function elencoCorrieri(x: unknown): Corriere[] {
  if (!Array.isArray(x) || x.length > MAX_CORRIERI)
    throw rifiuta("valore", 400, `Un elenco di corrieri, al massimo ${MAX_CORRIERI}.`);
  const visti = new Set<string>();
  return x.map((voce) => {
    if (!eOggetto(voce))
      throw rifiuta("valore", 400, "Ogni corriere ha un nome e, se vuoi, un modello di link.");
    const nome = testoBreve(
      voce.nome,
      NOME_CORRIERE_MAX,
      `Il nome del corriere è obbligatorio e può avere al massimo ${NOME_CORRIERE_MAX} caratteri.`,
    );
    if (visti.has(nome.toLowerCase()))
      throw rifiuta("valore", 400, `Il corriere «${nome}» è scritto due volte.`);
    visti.add(nome.toLowerCase());
    const modello = testoBreve(
      voce.modello,
      MODELLO_MAX,
      `Il modello di link può avere al massimo ${MODELLO_MAX} caratteri.`,
      true,
    );
    // stessa regola della pagina ordine: https, con {numero}, e il numero mai nel nome del sito
    if (modello && corriereLink([{ nome, modello }], nome, "1") === null)
      throw rifiuta(
        "valore",
        400,
        `Il modello di link di «${nome}» deve cominciare con https:// e contenere {numero} (non nel nome del sito), senza spazi. Oppure lascialo vuoto.`,
      );
    return { nome, modello };
  });
}
/** L'elenco com'è nel database (o come lo ha visto la schermata), ridotto a `{nome, modello}`: per il confronto. */
const normalizza = (x: unknown): Corriere[] =>
  (Array.isArray(x) ? x : [])
    .filter(eOggetto)
    .filter((v) => typeof v.nome === "string")
    .map((v) => ({
      nome: v.nome as string,
      modello: typeof v.modello === "string" ? v.modello : "",
    }));
const stessiCorrieri = (a: unknown, b: unknown): boolean =>
  JSON.stringify(normalizza(a)) === JSON.stringify(normalizza(b));

/* ══ LE LETTURE ═════════════════════════════════════════════════════════════ */

type Riga = Record<string, unknown>;

/** La tariffa com'è per il CRM. `confermata` come la vede il pubblico (la stessa funzione di T45), anche per una spenta. */
function vista(r: Riga, adesso: Date) {
  const s = leggiSpedizione({ ...r, attiva: true }, adesso);
  return {
    id: r.id,
    nome: r.nome,
    corriere: r.corriere ?? null,
    costoCent: r.costo_cent,
    giorniMin: r.giorni_min ?? null,
    giorniMax: r.giorni_max ?? null,
    attiva: r.attiva === true,
    provvisoria: r.provvisoria === true,
    confermata: s.stato === "ok" && s.confermata,
    confermataIl: r.confermata_il ?? null,
    aggiornatoIl: r.aggiornato_il ?? null,
  };
}

async function tutteLeTariffe(d: PorteDb): Promise<Riga[]> {
  return righe(
    dati(
      d,
      "lettura",
      await d.db.from("shop_spedizioni_tariffe").select(COLONNE).order("creato_il").limit(20),
    ),
  );
}
async function tariffaPerId(d: PorteDb, id: string): Promise<Riga> {
  const r = righe(
    dati(
      d,
      "lettura",
      await d.db.from("shop_spedizioni_tariffe").select(COLONNE).eq("id", id).limit(1),
    ),
  )[0];
  if (!r) throw rifiuta("non_trovato", 404, "Questa tariffa non esiste più: ricarica la pagina.");
  return r;
}
async function leggiCorrieri(d: PorteDb): Promise<{ trovato: boolean; valore: unknown }> {
  const r = righe(
    dati(
      d,
      "lettura",
      await d.db.from("shop_impostazioni").select("valore").eq("chiave", "corrieri").limit(1),
    ),
  );
  return { trovato: r.length > 0, valore: r[0]?.valore };
}
/** Le ultime modifiche (tariffa e corrieri), dal database. Un guasto qui non nasconde il resto: storico vuoto. */
async function storico(d: PorteDb) {
  try {
    const q = (entita: string, id?: string) => {
      const base = d.db
        .from("shop_storico")
        .select("entita, entita_id, campo, prima, dopo, chi, creato_il")
        .eq("entita", entita);
      return (id ? base.eq("entita_id", id) : base)
        .order("creato_il", { ascending: false })
        .limit(30);
    };
    const [a, b] = await Promise.all([q("tariffa"), q("impostazione", "corrieri")]);
    for (const e of [a, b]) if (e.error) throw e.error;
    return [...righe(a.data), ...righe(b.data)]
      .sort((x, y) => String(y.creato_il).localeCompare(String(x.creato_il)))
      .slice(0, 30)
      .map((r) => ({
        cosa: r.entita === "tariffa" ? "tariffa" : "corrieri",
        campo: r.campo,
        prima: r.prima ?? null,
        dopo: r.dopo ?? null,
        chi: r.chi ?? null,
        quando: r.creato_il,
      }));
  } catch (e) {
    d.log(`storico ${codiceDi(e as { code?: unknown })}`);
    return [];
  }
}

/* ══ LE SCRITTURE ═══════════════════════════════════════════════════════════ */

/** L'esito di una funzione di scrittura: `true` = scritto; `false` = la versione era cambiata. Gli errori noti hanno la loro frase. */
function esitoScambio(d: PorteDb, r: EsitoDb): void {
  if (r.error) {
    const codice = codiceDi(r.error);
    if (eMancante(r.error)) throw senzaMigrazione();
    if (codice === "P0002")
      throw rifiuta("non_trovato", 404, "Questa tariffa non esiste più: ricarica la pagina.");
    if (codice === "23505")
      throw conflitto(
        "C'è già un'altra tariffa attiva per l'Italia: spegni prima quella, oppure modifica quella.",
      );
    if (codice === "23514" || codice === "22023")
      throw rifiuta(
        "valore",
        400,
        "Il database non accetta uno dei valori: controlla i campi e riprova.",
      );
    throw guasto(d, "scambio", r.error);
  }
  if (r.data !== true) throw conflitto(FRASE_VERSIONE);
}

/** La tariffa com'è ORA nel database (la versione nuova, mai calcolata qui); `null` se non si riesce a leggerla: la scrittura è fatta. */
async function riletta(d: PorteDb, id: string) {
  try {
    return vista(await tariffaPerId(d, id), d.adesso());
  } catch {
    d.log("rilettura");
    return null;
  }
}

async function salvaTariffa(corpo: Record<string, unknown>, chi: string, d: PorteDb) {
  const id = idTariffa(corpo.id);
  const atteso = versioneVista(corpo.atteso);
  const nuovi = campiTariffa(corpo);

  const riga = await tariffaPerId(d, id);
  const prima = vista(riga, d.adesso());
  if (!stessoIstante(riga.aggiornato_il, atteso))
    throw conflitto(FRASE_VERSIONE, { tariffa: prima });
  const cambi = Object.fromEntries(
    Object.entries(nuovi).filter(([k, v]) => (riga[k] ?? null) !== v),
  );
  if (!Object.keys(cambi).length) return { cambiato: false, tariffa: prima };

  esitoScambio(
    d,
    await d.db.rpc("shop_tariffa_imposta", {
      p_id: id,
      p_atteso: riga.aggiornato_il,
      p_campi: cambi,
      p_conferma: false,
      p_chi: chi,
    }),
  );
  return {
    cambiato: true,
    tariffa: await riletta(d, id),
    ...(prima.confermata
      ? { avviso: "Questa tariffa era già confermata: la modifica è subito visibile ai clienti." }
      : {}),
  };
}

async function confermaTariffa(corpo: Record<string, unknown>, chi: string, d: PorteDb) {
  const id = idTariffa(corpo.id);
  const atteso = versioneVista(corpo.atteso);
  const riga = await tariffaPerId(d, id);
  const prima = vista(riga, d.adesso());
  if (!stessoIstante(riga.aggiornato_il, atteso))
    throw conflitto(FRASE_VERSIONE, { tariffa: prima });
  if (prima.confermata) return { cambiato: false, tariffa: prima }; // già confermata: la data della conferma non si sposta

  esitoScambio(
    d,
    await d.db.rpc("shop_tariffa_imposta", {
      p_id: id,
      p_atteso: riga.aggiornato_il,
      p_campi: {},
      p_conferma: true,
      p_chi: chi,
    }),
  );
  return { cambiato: true, tariffa: await riletta(d, id) };
}

async function salvaCorrieri(corpo: Record<string, unknown>, chi: string, d: PorteDb) {
  const nuovo = elencoCorrieri(corpo.corrieri);
  if (!Array.isArray(corpo.atteso))
    throw rifiuta("valore", 400, "Manca l'elenco che vedevi prima del cambio: ricarica la pagina.");

  const { trovato, valore } = await leggiCorrieri(d);
  if (!trovato) throw senzaMigrazione(); // il seme lo mette S5: qui non si inventano chiavi
  if (!stessiCorrieri(valore, corpo.atteso))
    throw conflitto(FRASE_VERSIONE, { corrieri: normalizza(valore) });
  if (stessiCorrieri(valore, nuovo)) return { cambiato: false, corrieri: nuovo };

  esitoScambio(
    d,
    await d.db.rpc("shop_impostazione_imposta", {
      p_chiave: "corrieri",
      p_atteso: valore,
      p_nuovo: nuovo,
      p_chi: chi,
    }),
  );
  return { cambiato: true, corrieri: nuovo };
}

export const eseguiSpedizioni = async (
  azione: string,
  corpo: Record<string, unknown>,
  chi: string,
  d: PorteDb,
) => {
  if (azione === "tariffa_salva") return salvaTariffa(corpo, chi, d);
  if (azione === "tariffa_conferma") return confermaTariffa(corpo, chi, d);
  if (azione === "corrieri_salva") return salvaCorrieri(corpo, chi, d);
  throw rifiuta("azione_sconosciuta", 400, "Questa azione non è prevista."); // mai un'azione di ripiego
};

export const gestisciGET = (request: Request, d: PorteDb): Promise<Response> =>
  gestisci(request, d, async () => {
    if (!new URL(request.url).searchParams.has("spedizioni"))
      throw rifiuta("azione_sconosciuta", 400, "Questa lettura non è prevista.");
    const tariffe = await tutteLeTariffe(d);
    const corrente = tariffe.find((r) => r.attiva === true) ?? tariffe[0];
    const { valore } = await leggiCorrieri(d);
    return {
      tariffa: corrente ? vista(corrente, d.adesso()) : null,
      corrieri: normalizza(valore),
      storico: await storico(d),
    };
  });

export const gestisciPOST = (request: Request, d: PorteDb): Promise<Response> =>
  gestisci(request, d, async (chi) => {
    const corpo = await leggiCorpo(request);
    return eseguiSpedizioni(azioneDi(corpo, AZIONI_SPEDIZIONI), corpo, chi, d);
  });
