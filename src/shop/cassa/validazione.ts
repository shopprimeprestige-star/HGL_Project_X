/** ── LA CASSA: VALIDAZIONE DELLA RICHIESTA (PURA) ───────────────────────────
 *  Commessa 2026-11-20-shop-completo, R2 · T48 (PIANO-R2 §3.1 punto 3; SPEC 7.4 n. 6; D14). Nessun database, nessuna rete.
 *  `validaRichiesta(corpo)`: legge il corpo di `POST /api/public/shop-cassa` e restituisce i dati NORMALIZZATI (`{ok:true, valore}`)
 *  oppure `{ok:false, motivo:"valore", frase, campi:{campo: frase}}` con TUTTI i campi sbagliati, uno per uno.
 *  · di ogni sezione si leggono le sole chiavi del contratto: il resto (prezzi compresi) non passa; nessuna conversione di tipo
 *    (un «2» al posto di 2 è sbagliato, non diventa 2);
 *  · codice fiscale, P.IVA, SDI, PEC, CAP, provincia e telefono si controllano con i validatori di T45 (`fiscale.ts`), mai con copie;
 *  · le frasi non ripetono quello che ha scritto il cliente, e qui non si scrive nessun log: un dato personale non ha dove finire;
 *  · i limiti di quantità e i prezzi non sono di questo file: li decide `calcolo.ts` sulle righe del server. */
import { normalizzaEmail } from "@/lib/tracciamento/hash";
import { CHIAVI_QUERY_AMMESSE } from "@/lib/tracciamento/ammesse";
import { MAX_RIGHE } from "./calcolo";
import {
  validaCap,
  validaCodiceFiscale,
  validaPartitaIva,
  validaPec,
  validaProvincia,
  validaSdi,
  validaTelefono,
  type Esito,
} from "./fiscale";

export type FatturaCassa = {
  tipo: "privato" | "azienda";
  denominazione: string;
  cf?: string;
  piva?: string;
  sdi?: string;
  pec?: string;
};
export type RichiestaValida = {
  permesso: string;
  tentativo: string;
  totaleAttesoCent: number;
  righe: { sku: string; qty: number }[];
  contatti: { nome: string; cognome: string; email: string; telefono: string };
  spedizione: { indirizzo: string; citta: string; cap: string; provincia: string; nazione: "IT" };
  note: string | null;
  fattura: FatturaCassa | null;
  consensi: { termini: true; privacy: true; versione: string };
  consensoMarketing: boolean;
  attribuzione: Record<string, string>;
};
export type EsitoRichiesta =
  | { ok: true; valore: RichiestaValida }
  | { ok: false; motivo: "valore"; frase: string; campi: Record<string, string> };

const MAX_NOME = 60;
const MAX_INDIRIZZO = 120;
const MAX_CITTA = 80;
const MAX_NOTE = 500;
const MAX_EMAIL = 254;
const MAX_DENOMINAZIONE = 120;
const MAX_PERMESSO = 200;
const MAX_VERSIONE = 40;
const MAX_SKU = 64;
/** Attribuzione: poche chiavi, valori corti. Un valore o una chiave che non va si scarta (la vendita non si ferma per un'etichetta di campagna). */
const MAX_ATTRIBUZIONE = 20;
const MAX_VALORE_ATTRIBUZIONE = 200;
/** I cookie delle piattaforme (D14 ne ammette il click id; qui anche `fbp`/`fbc`/`external_id`), solo con il consenso di marketing. */
const CHIAVI_CON_CONSENSO: readonly string[] = [
  ...CHIAVI_QUERY_AMMESSE,
  "fbp",
  "fbc",
  "external_id",
];
const UTM = /^utm_[a-z0-9_]{1,40}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const oggetto = (x: unknown): x is Record<string, unknown> =>
  typeof x === "object" && x !== null && !Array.isArray(x);
const intero = (n: unknown): n is number => typeof n === "number" && Number.isSafeInteger(n);
const proprio = (o: Record<string, unknown>, k: string): unknown =>
  Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined;
/** Togli i caratteri di controllo (NUL, ESC, BEL…): tab e ritorni a capo restano solo se `aCapo`. */
function senzaControllo(t: string, aCapo: boolean): string {
  let fuori = "";
  for (const ch of t) {
    const codice = ch.codePointAt(0) ?? 0;
    const controllo = codice < 32 || codice === 127;
    if (!controllo || (aCapo && (codice === 9 || codice === 10 || codice === 13))) fuori += ch;
  }
  return fuori;
}

/** Un testo da una riga: spazi doppi e ai bordi tolti. `null` se non è testo, è vuoto o supera il tetto. */
function riga(x: unknown, max: number): string | null {
  if (typeof x !== "string") return null;
  const t = senzaControllo(x.replace(/\s+/g, " "), false).trim();
  return t !== "" && t.length <= max ? t : null;
}

export function validaRichiesta(corpo: unknown): EsitoRichiesta {
  const campi: Record<string, string> = {};
  const sbaglia = (campo: string, frase: string) => {
    campi[campo] ??= frase;
  };
  /** Un validatore di T45: il valore normalizzato, o la sua frase accanto al campo. */
  const con = (campo: string, e: Esito): string => {
    if (e.ok) return e.valore;
    sbaglia(campo, e.frase);
    return "";
  };
  const c = oggetto(corpo) ? corpo : {};
  const contatti = oggetto(c.contatti) ? c.contatti : {};
  const sped = oggetto(c.spedizione) ? c.spedizione : {};
  const cons = oggetto(c.consensi) ? c.consensi : {};

  // ── la richiesta in sé ──
  const permesso =
    typeof c.permesso === "string" && c.permesso !== "" && c.permesso.length <= MAX_PERMESSO
      ? c.permesso
      : "";
  if (!permesso) sbaglia("permesso", "Ricarica la pagina e riprova.");
  const tentativo = typeof c.tentativo === "string" && UUID.test(c.tentativo) ? c.tentativo : "";
  if (!tentativo) sbaglia("tentativo", "Ricarica la pagina e riprova.");
  const totaleAttesoCent =
    intero(c.totaleAttesoCent) && c.totaleAttesoCent >= 0 ? c.totaleAttesoCent : -1;
  if (totaleAttesoCent < 0) sbaglia("totaleAttesoCent", "Ricarica la pagina e riprova.");

  const righe: { sku: string; qty: number }[] = [];
  const grezze = Array.isArray(c.righe) ? c.righe : null;
  if (!grezze || grezze.length < 1 || grezze.length > MAX_RIGHE)
    sbaglia("righe", `Il carrello deve avere da 1 a ${MAX_RIGHE} prodotti.`);
  else
    for (const r of grezze) {
      if (
        oggetto(r) &&
        typeof r.sku === "string" &&
        r.sku !== "" &&
        r.sku.length <= MAX_SKU &&
        intero(r.qty)
      )
        righe.push({ sku: r.sku, qty: r.qty });
      else {
        sbaglia("righe", "Il carrello non è valido: controlla i prodotti e le quantità.");
        break;
      }
    }

  // ── contatti e spedizione ──
  const nome = riga(contatti.nome, MAX_NOME);
  if (nome === null) sbaglia("nome", "Scrivi il tuo nome.");
  const cognome = riga(contatti.cognome, MAX_NOME);
  if (cognome === null) sbaglia("cognome", "Scrivi il tuo cognome.");
  const emailPulita =
    typeof contatti.email === "string" && contatti.email.length <= MAX_EMAIL
      ? normalizzaEmail(contatti.email)
      : "";
  const email = /^[^@\s]+@[^@\s.]+(\.[^@\s.]+)*\.[^@\s.]{2,}$/.test(emailPulita) ? emailPulita : "";
  if (!email) sbaglia("email", "L'email non sembra giusta: manca qualcosa prima o dopo la @.");
  const telefono = con("telefono", validaTelefono(contatti.telefono));
  const indirizzo = riga(sped.indirizzo, MAX_INDIRIZZO);
  if (indirizzo === null) sbaglia("indirizzo", "Scrivi l'indirizzo, con il numero civico.");
  const citta = riga(sped.citta, MAX_CITTA);
  if (citta === null) sbaglia("citta", "Scrivi la città.");
  const cap = con("cap", validaCap(sped.cap));
  const provincia = con("provincia", validaProvincia(sped.provincia));
  // Si spedisce solo in Italia (SPEC §12.4.2: nessun campo Nazione): assente vale IT, qualunque altra cosa no.
  const nazione =
    sped.nazione === undefined ||
    (typeof sped.nazione === "string" && sped.nazione.trim().toUpperCase() === "IT");
  if (!nazione) sbaglia("nazione", "Per ora spediamo solo in Italia.");

  let note: string | null = null;
  if (c.note !== undefined && c.note !== null) {
    if (typeof c.note !== "string") sbaglia("note", "Le note non sono valide.");
    else {
      const t = senzaControllo(c.note, true).trim();
      if (t.length > MAX_NOTE)
        sbaglia("note", `Le note possono avere al massimo ${MAX_NOTE} caratteri.`);
      else note = t === "" ? null : t;
    }
  }

  // ── la fattura: se c'è, è completa e giusta ──
  let fattura: FatturaCassa | null = null;
  if (c.fattura !== undefined && c.fattura !== null) {
    const f = oggetto(c.fattura) ? c.fattura : null;
    if (!f) sbaglia("fattura", "I dati per la fattura non sono validi.");
    else {
      const tipo = f.tipo === "privato" || f.tipo === "azienda" ? f.tipo : null;
      if (!tipo) sbaglia("tipo", "Scegli se la fattura è per un privato o per un'azienda.");
      const denominazione = riga(f.denominazione, MAX_DENOMINAZIONE);
      if (denominazione === null)
        sbaglia(
          "denominazione",
          tipo === "azienda"
            ? "Scrivi la ragione sociale."
            : "Scrivi nome e cognome per la fattura.",
        );
      const presente = (k: string) =>
        (typeof proprio(f, k) === "string" && (proprio(f, k) as string).trim() !== "") ||
        (proprio(f, k) !== undefined &&
          proprio(f, k) !== null &&
          typeof proprio(f, k) !== "string");
      const out: FatturaCassa = { tipo: tipo ?? "privato", denominazione: denominazione ?? "" };
      const campo = (
        k: "cf" | "piva" | "sdi" | "pec",
        valida: (x: unknown) => Esito,
        obbligatorio: boolean,
        frase: string,
      ) => {
        if (presente(k)) out[k] = con(k, valida(f[k]));
        else if (obbligatorio) sbaglia(k, frase);
      };
      campo(
        "cf",
        validaCodiceFiscale,
        tipo === "privato",
        "Scrivi il codice fiscale per la fattura.",
      );
      campo("piva", validaPartitaIva, tipo === "azienda", "Scrivi la partita IVA per la fattura.");
      campo("sdi", validaSdi, false, "");
      campo("pec", validaPec, false, "");
      fattura = out;
    }
  }

  // ── le due caselle di legge e la versione dei testi ──
  if (cons.termini !== true)
    sbaglia("termini", "Per ordinare devi accettare i termini e condizioni.");
  if (cons.privacy !== true)
    sbaglia("privacy", "Per ordinare devi aver letto l'informativa sulla privacy.");
  const versione =
    typeof cons.versione === "string" &&
    cons.versione.trim() !== "" &&
    cons.versione.length <= MAX_VERSIONE
      ? cons.versione.trim()
      : "";
  if (!versione) sbaglia("versione", "Ricarica la pagina e riprova.");

  if (Object.keys(campi).length > 0)
    return { ok: false, motivo: "valore", frase: "Controlla i campi segnati e riprova.", campi };

  // Sempre e solo `=== true`: un «true» scritto come testo non è un consenso.
  const consensoMarketing = c.consensoMarketing === true;
  return {
    ok: true,
    valore: {
      permesso,
      tentativo,
      totaleAttesoCent,
      righe,
      contatti: { nome: nome!, cognome: cognome!, email, telefono },
      spedizione: { indirizzo: indirizzo!, citta: citta!, cap, provincia, nazione: "IT" },
      note,
      fattura,
      consensi: { termini: true, privacy: true, versione },
      consensoMarketing,
      attribuzione: filtraAttribuzione(c.attribuzione, consensoMarketing),
    },
  };
}

/** Solo le chiavi ammesse (D14), valori di testo corti. Senza il consenso di marketing restano le sole `utm_*`: i click id e i cookie
 *  delle piattaforme (`fbp`, `fbc`, `fbclid`, `gclid`, `ttclid`, `external_id`…) non entrano. Mai un errore: ciò che non va si scarta. */
function filtraAttribuzione(grezza: unknown, consenso: boolean): Record<string, string> {
  const fuori: Record<string, string> = {};
  if (!oggetto(grezza)) return fuori;
  let n = 0;
  for (const k of Object.keys(grezza)) {
    if (n >= MAX_ATTRIBUZIONE) break;
    const v = proprio(grezza, k);
    const ammessa = UTM.test(k) || (consenso && CHIAVI_CON_CONSENSO.includes(k));
    if (!ammessa || typeof v !== "string") continue;
    const t = senzaControllo(v, false).trim();
    if (t === "" || t.length > MAX_VALORE_ATTRIBUZIONE) continue;
    fuori[k] = t;
    n++;
  }
  return fuori;
}
