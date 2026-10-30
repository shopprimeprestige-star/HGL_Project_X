/** ── PONTE WHATSAPP: L'ABBINAMENTO CON MANYCHAT E CLOUD ─────────────────────
 *
 *  Commessa 2026-10-29-ponte-whatsapp-baileys, compito T3 (PIANO §c1, D4, D5).
 *  Funzioni PURE: niente database, niente `fetch`. Prove in
 *  `prove/ponte/pari.mjs` (i 12 casi del §c1 e i limiti).
 *
 *  Un messaggio del ponte è il «pari» di una riga che il CRM ha già (ManyChat
 *  o Cloud) se: stessa persona (cifre intere), stessa direzione, vicino nel
 *  tempo, stesso testo normalizzato (o il caso «opaco»). Uno a uno, il più
 *  vicino. Il pari si scrive come `duplicato_di` e la chat lo nasconde.
 *
 *  ⚠️ Le regole 1-4 (lato CRM) le applica l'SQL di `ponte_wa_candidati` (T1);
 *   `ammessoCome` è la stessa regola in TypeScript, per le prove e per il
 *   database finto di T4. Le due devono dire la stessa cosa.
 *  ⚠️ Nessun confronto sfumato, nessun abbinamento fra numeri diversi: nel
 *   dubbio la riga del ponte resta visibile (un messaggio in più è meglio di
 *   un messaggio vero nascosto).
 *  ───────────────────────────────────────────────────────────────────────── */
import { classificaTesto } from "../chatwa/media";
import {
  CANALE_PONTE,
  CONFRONTO_CARATTERI,
  FINESTRA_OPACA_S,
  FINESTRA_PARI_S,
  cifre,
  type CandidatoCrm,
  type Pari,
  type RichiestaCandidato,
  type RigaDaAbbinare,
} from "./tipi";

/** La marca dei modelli che il ponte legge (`templateMessage`,
 *  `interactiveMessage`, `buttonsMessage`, `listMessage`,
 *  `highlyStructuredMessage`, `placeholderMessage`): il testo del ponte
 *  comincia così. Copiata in `strumenti/ponte-whatsapp/src/estrai.mjs` (le
 *  prove confrontano i valori). Guasto 2: un `[template:…]` del CRM fa da pari
 *  SOLO a un modello, mai a un testo o a un media mandati a mano dall'app. */
export const MARCA_MODELLO = "📋 ";
/** Un modello uscito di cui WhatsApp non ha dato il testo al ponte. */
export const MODELLO_NASCOSTO = "📋 Modello inviato (testo non visibile)";

/** Il giro ManyChat esce dal ponte anche come testo semplice già compilato,
 *  1-2 s dopo la riga `[template:…]` (visto in produzione): un testo semplice
 *  fa da pari a un `[template:…]` solo entro questa finestra, così un
 *  messaggio scritto a mano dall'app poco dopo resta visibile. */
export const FINESTRA_ECO_MODELLO_S = 15;

/** Un invio fatto dall'API (ManyChat) che WhatsApp non mostra ai dispositivi
 *  collegati (`hosted_unavailable_fanout`): il ponte ne sa solo numero e ora. */
export const INVIO_NASCOSTO = "📋 Messaggio inviato da ManyChat (testo non visibile)";

/** Un messaggio del cliente che WhatsApp ha consegnato al Mac ma che il ponte non
 *  ha potuto leggere (non decifrato, e il telefono non l'ha rimandato): il
 *  ponte ne sa solo numero e ora. Copiata in `strumenti/ponte-whatsapp/src/
 *  estrai.mjs` (le prove confrontano i valori). Fa da pari a un'ENTRATA vicina
 *  del CRM (ManyChat ha letto lo stesso messaggio, di solito in pochi secondi) solo
 *  in un SECONDO passaggio (`abbinaPari`), con i candidati che i messaggi veri non
 *  hanno preso, e solo entro `FINESTRA_NON_DECIFRATO_S`: ManyChat può aver perso il
 *  messaggio (47 entrate viste solo dal ponte) e allora il segnaposto deve restare
 *  visibile, mai rubare la riga di un altro messaggio. */
export const FINESTRA_NON_DECIFRATO_S = 20;
export const NON_DECIFRATO = "⚠️ Messaggio non leggibile dal ponte: aprilo sul telefono";

/** Le righe del ponte uscite senza niente da mostrare: fanno da pari a
 *  qualunque uscita del CRM vicina (nasconderle non toglie niente). */
const SENZA_TESTO_DEL_PONTE: readonly string[] = [MODELLO_NASCOSTO, INVIO_NASCOSTO];

const eModelloDelPonte = (x: string | null | undefined): boolean =>
  typeof x === "string" && x.startsWith(MARCA_MODELLO);

/** Caratteri invisibili che ManyChat o le tastiere aggiungono (§c1.5). */
const INVISIBILI = /[\u200B-\u200D\uFEFF\u2060]/g;

/** Il testo come si confronta (§c1.5): NFKC, minuscole, senza invisibili,
 *  spazi e a capo ridotti a uno, senza bordi. Il taglio a
 *  `CONFRONTO_CARATTERI` lo fa il confronto, non questa funzione. */
export function normalizzaTesto(testo: string | null | undefined): string {
  if (typeof testo !== "string") return "";
  return testo.normalize("NFKC").toLowerCase().replace(INVISIBILI, "").replace(/\s+/g, " ").trim();
}

/** Che tipo di riga «opaca» è una riga del CRM (il CRM non ha il testo vero):
 *  `modello` = `[template:…]` (un modello inviato); `media` = media di
 *  ManyChat (link `manybot-files`), `[messaggio senza testo]` o fatto solo di
 *  `{{…}}`. `null` = testo vero, si confronta il testo. Il riconoscimento dei
 *  media è quello della chat (`classificaTesto`), così il pari si vede come
 *  la chat lo disegna. */
export function eOpaco(body: string | null | undefined): "modello" | "media" | null {
  if (typeof body !== "string") return null;
  const t = body.trim();
  if (/^\[template:[^\]]*\]$/.test(t)) return "modello";
  return classificaTesto(t).tipo === "testo" ? null : "media";
}

/** Una riga di `whatsapp_messages` come la legge `ponte_wa_candidati`. */
export interface RigaCrm {
  id: string;
  direction: string;
  from_number: string | null;
  to_number: string | null;
  body: string | null;
  canale: string | null;
  status: string | null;
  duplicato_di: string | null;
  /** ISO 8601 */
  created_at: string;
}

/** Il cliente di una riga del CRM, in cifre (§0, correzione 1): il lato che
 *  non è il canale. Mai l'altro lato («manychat», `phone_number_id`). */
export function clienteCrm(r: Pick<RigaCrm, "direction" | "from_number" | "to_number">): string {
  return cifre(r.direction === "inbound" ? r.from_number : r.to_number);
}

/** Secondi fra il messaggio del ponte e la riga del CRM. */
function distanza(t: number, createdAt: string): number {
  return Math.abs(t - Date.parse(createdAt) / 1000);
}

/** Le regole 1-4 del §c1: la riga CRM può essere il pari della richiesta?
 *  (L'utente e il «non già presa» li controlla l'SQL.) */
export function ammessoCome(r: RigaCrm, q: RichiestaCandidato): boolean {
  return (
    r.canale !== CANALE_PONTE &&
    r.duplicato_di == null &&
    r.status !== "failed" &&
    clienteCrm(r) === q.n &&
    r.direction === (q.d === "in" ? "inbound" : "outbound") &&
    distanza(q.t, r.created_at) <= FINESTRA_PARI_S
  );
}

/** Le regole 4-5 fra una riga del ponte e un candidato già filtrato.
 *  Uscite: una riga del ponte senza testo (modello nascosto) fa da pari a
 *  ogni uscita del CRM entro la finestra opaca; un `[template:…]` del CRM a
 *  un modello del ponte (marca `MARCA_MODELLO`) entro la finestra opaca, a un
 *  testo semplice solo entro `FINESTRA_ECO_MODELLO_S`, mai a un media. */
function compatibili(riga: RigaDaAbbinare, c: CandidatoCrm): boolean {
  if (c.k !== riga.k || c.canale === CANALE_PONTE) return false;
  if (c.direction !== (riga.d === "in" ? "inbound" : "outbound")) return false;
  const dt = distanza(riga.t, c.created_at);
  if (!Number.isFinite(dt)) return false;
  if (riga.x === NON_DECIFRATO) return riga.d === "in" && dt <= FINESTRA_NON_DECIFRATO_S;
  if (riga.d === "out" && SENZA_TESTO_DEL_PONTE.includes(riga.x)) return dt <= FINESTRA_OPACA_S;
  const opaco = eOpaco(c.body);
  if (opaco === "modello") {
    if (riga.d !== "out") return false;
    if (eModelloDelPonte(riga.x)) return dt <= FINESTRA_OPACA_S;
    return riga.m === null && dt <= FINESTRA_ECO_MODELLO_S;
  }
  if (opaco === "media") return riga.d === "in" && riga.m !== null && dt <= FINESTRA_OPACA_S;
  if (dt > FINESTRA_PARI_S) return false;
  const testo = eModelloDelPonte(riga.x) ? riga.x.slice(MARCA_MODELLO.length) : riga.x;
  const a = normalizzaTesto(testo).slice(0, CONFRONTO_CARATTERI);
  return a !== "" && a === normalizzaTesto(c.body).slice(0, CONFRONTO_CARATTERI);
}

/** Le regole 4-7 del §c1, uno a uno: i messaggi del ponte in ordine di `ts`
 *  (a parità, di chiave), a ciascuno il candidato compatibile non ancora usato
 *  più vicino nel tempo (a parità il più vecchio, poi l'id). Un candidato si
 *  usa una volta sola, anche se l'SQL lo ha restituito per più chiavi. */
export function abbinaPari(righe: RigaDaAbbinare[], candidati: CandidatoCrm[]): Pari[] {
  const usati = new Set<string>();
  const pari: Pari[] = [];
  const ordinate = [...righe].sort((a, b) => a.t - b.t || (a.k < b.k ? -1 : a.k > b.k ? 1 : 0));
  //  Due passaggi: prima i messaggi veri; i segnaposto «non leggibile» solo dopo, con le
  //  righe CRM rimaste (mai davanti a un messaggio vero che le avrebbe prese).
  for (const passaggio of [false, true]) {
    for (const riga of ordinate) {
      if ((riga.x === NON_DECIFRATO) !== passaggio) continue;
      let scelto: CandidatoCrm | null = null;
      for (const c of candidati) {
        if (usati.has(c.id) || !compatibili(riga, c)) continue;
        if (!scelto) {
          scelto = c;
          continue;
        }
        const d = distanza(riga.t, c.created_at) - distanza(riga.t, scelto.created_at);
        const eta = Date.parse(c.created_at) - Date.parse(scelto.created_at);
        if (d < 0 || (d === 0 && (eta < 0 || (eta === 0 && c.id < scelto.id)))) scelto = c;
      }
      if (scelto) {
        usati.add(scelto.id);
        pari.push({ k: riga.k, crm: scelto.id });
      }
    }
  }
  return pari;
}
