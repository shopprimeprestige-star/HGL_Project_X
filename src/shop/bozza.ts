// ── IL PREVENTIVO LASCIATO A METÀ ───────────────────────────────────────────
//  Comporre un preventivo davanti al cliente richiede minuti. Basta passare a
//  Media, alle Slide o a un sito per ritrovarsi da capo: la schermata del
//  preventivo viene smontata, e con lei tutto quello che avevi scelto.
//
//  Da qui in poi il lavoro resta. Si salva su QUESTO dispositivo a ogni scelta e
//  di nuovo nell'istante in cui esci dalla schermata, e alla riapertura viene
//  OFFERTO — mai applicato di nascosto: ritrovarsi addosso i dati di un altro
//  cliente mentre uno ti guarda è peggio del danno che si vuole evitare.
//
//  Sta in un file suo, e non dentro la pagina, perché lo legge anche la barra:
//  è lì che compare "Riprendi la bozza", e la barra vive su tutte le schermate.
import { BASE_SOLUTIONS, DEFAULT_SELECTED } from "@/shop/quote-menu";

export const BOZZA_KEY = "hg_bozza_preventivo";

export interface BozzaProfilo {
  nome?: string; cognome?: string; email?: string; telefono?: string;
  eta?: string; greyPct?: string; colorCode?: string; problemi?: string;
}
export interface Bozza {
  v?: number;
  /** la consulenza a cui appartiene: le bozze non si mescolano fra clienti */
  code?: string;
  at?: number;
  baseId?: string;
  selected?: string[];
  simOn?: boolean;
  installOn?: boolean;
  installLoc?: "studio" | "home";
  fitting?: "remoto" | "sede";
  qty?: number;
  profile?: BozzaProfilo;
  /** sotto-scelte (intensità dell'onda, ampiezza del riccio) */
  varianti?: Record<string, string>;
  /** ── IL CODICE SCONTO FA PARTE DEL LAVORO ───────────────────────────────
   *  Segnalazione del committente: «se applico il codice sconto si elimina
   *  appena recupero il preventivo e devo reinserirlo». Era vero: la bozza
   *  salvava le scelte ma non il codice, quindi tornando indietro il prezzo
   *  risaliva e bisognava riscriverlo davanti al cliente.
   *  Si salva il CODICE, non lo sconto già calcolato: alla ripresa si
   *  ricontrolla sul server — un codice può essere scaduto o esaurito nel
   *  frattempo, e riapplicarlo alla cieca vorrebbe dire promettere un prezzo
   *  che non esiste più. */
  codice?: string;
  /** ── HAI TOCCATO LE SCELTE CON LE TUE MANI? ─────────────────────────────
   *  Segnalazione del committente: «ogni volta che apro il preventivo chiede
   *  di recuperarlo anche se non c'è niente da recuperare».
   *
   *  ⚠️ PERCHÉ SUCCEDEVA, ED ERA UN CONFRONTO IMPOSSIBILE DA VINCERE. Per
   *   sapere se c'era del lavoro si confrontava la bozza con «com'è il
   *   configuratore appena aperto». Ma le spunte di partenza le decide il
   *   LISTINO, che arriva dal server un istante dopo: la bozza veniva salvata
   *   con le spunte del listino, e alla riapertura il confronto avveniva
   *   contro il ripiego di serie — due liste diverse, quindi «hai toccato
   *   qualcosa», quindi la scheda gialla. Ogni volta, su una pagina mai
   *   sfiorata.
   *  Adesso non si indovina più: la pagina DICHIARA se le scelte sono state
   *   toccate a mano (`sceltoAMano`). Una dichiarazione non ha bisogno di un
   *   termine di paragone che arriva in ritardo.
   *  ⚠️ Assente = bozza scritta da una versione precedente: per quelle si
   *   torna al vecchio confronto, che sbagliava per eccesso — offrire una
   *   bozza di troppo è meglio che perdere del lavoro vero. */
  toccato?: boolean;
}

/** Com'è il configuratore appena aperto: serve a capire se hai toccato qualcosa. */
export interface PartenzaBozza {
  baseId: string;
  selected: string[];
  simOn: boolean;
  installOn: boolean;
  installLoc: "studio" | "home";
  fitting: "remoto" | "sede";
  qty: number;
}

/** I valori con cui nasce il configuratore. Stanno qui perché servono a due
 *  cose che devono restare d'accordo fra loro: azzerarlo con "Nuovo
 *  preventivo", e capire se hai toccato qualcosa — cioè se c'è del lavoro da
 *  offrirti al ritorno. */
export const PARTENZA: PartenzaBozza = {
  baseId: BASE_SOLUTIONS[0].id,
  selected: [...DEFAULT_SELECTED],
  simOn: false,
  //  ⚠️ Spenta di partenza, come nel pannello: la calibrazione si sceglie.
  //   Tenerla accesa qui rimetterebbe i 70 € a ogni "Nuovo preventivo".
  installOn: false,
  installLoc: "studio",
  fitting: "remoto",
  qty: 1,
};

const uguali = (a: string[] = [], b: string[] = []) =>
  a.length === b.length && a.every((x) => b.includes(x));

/** Vale la pena offrirla?
 *
 *  Il criterio è "hai toccato qualcosa", non "hai scritto il nome": la maggior
 *  parte del lavoro di un preventivo sta nelle scelte — la base, le aggiunte, la
 *  quantità, dove si fa l'installazione — e quasi sempre si fanno PRIMA di
 *  chiedere i dati. Con un criterio più stretto la bozza non veniva offerta
 *  proprio nei casi in cui serviva. Una schermata mai toccata, invece, non è
 *  lavoro lasciato a metà: quella non si propone. */
export function bozzaUtile(b: Bozza | null | undefined, p: PartenzaBozza): boolean {
  if (!b) return false;
  /*  Queste risposte non dipendono dal listino: i valori di partenza sono
      costanti (niente simulazione, niente installazione, studio, da remoto,
      quantità 1) e la pagina nasce esattamente così. Qui il confronto è
      affidabile, e resta. */
  const pr = b.profile;
  if (pr && (pr.nome || pr.cognome || pr.telefono || pr.email || pr.problemi || pr.eta || pr.greyPct || pr.colorCode)) return true;
  if (typeof b.qty === "number" && b.qty !== p.qty) return true;
  if (typeof b.simOn === "boolean" && b.simOn !== p.simOn) return true;
  if (typeof b.installOn === "boolean" && b.installOn !== p.installOn) return true;
  if (b.installLoc && b.installLoc !== p.installLoc) return true;
  if (b.fitting && b.fitting !== p.fitting) return true;
  //  Un codice applicato è lavoro fatto anche se non si è toccato altro.
  if (b.codice) return true;
  /*  ── ⚠️ LE SCELTE: SI CREDE ALLA BOZZA, NON AL CONFRONTO ──────────────
      La strada e le spunte sono le uniche due cose la cui «partenza» dipende
      dal listino, cioè da una risposta del server che alla riapertura non è
      ancora arrivata. Confrontarle era il guasto: vedi la nota su `toccato`.
      Se la bozza lo dichiara si usa quello, e non si guarda altro. */
  if (typeof b.toccato === "boolean") return b.toccato;
  if (b.baseId && b.baseId !== p.baseId) return true;
  if (Array.isArray(b.selected) && !uguali(b.selected, p.selected)) return true;
  return false;
}

export function leggiBozza(): Bozza | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(BOZZA_KEY);
    return raw ? (JSON.parse(raw) as Bozza) : null;
  } catch { return null; }
}
export function salvaBozza(b: Bozza) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(BOZZA_KEY, JSON.stringify(b)); } catch { /* */ }
}
export function eliminaBozza() {
  if (typeof window === "undefined") return;
  try { localStorage.removeItem(BOZZA_KEY); } catch { /* */ }
}

/** C'è del lavoro da riprendere per QUESTA consulenza? (lo chiede la barra) */
export function bozzaDisponibile(code: string | null, p: PartenzaBozza = PARTENZA): Bozza | null {
  const b = leggiBozza();
  if (!b) return null;
  //  Confronto STRETTO: una bozza senza codice, o con quello di un'altra
  //  consulenza, non è di questa e non si offre. Aprendo una consulenza nuova
  //  si parte puliti: il lavoro sul cliente precedente non deve comparire
  //  davanti a quello dopo.
  if (!b.code || !code || b.code !== code) return null;
  return bozzaUtile(b, p) ? b : null;
}

/** "3 minuti fa", "ieri" — il tempo detto come lo direbbe una persona. */
export function quandoBozza(at?: number): string {
  if (!at) return "";
  const m = Math.max(0, Math.round((Date.now() - at) / 60000));
  if (m < 1) return "poco fa";
  if (m < 60) return `${m} minut${m === 1 ? "o" : "i"} fa`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} or${h === 1 ? "a" : "e"} fa`;
  const g = Math.round(h / 24);
  return g === 1 ? "ieri" : `${g} giorni fa`;
}
