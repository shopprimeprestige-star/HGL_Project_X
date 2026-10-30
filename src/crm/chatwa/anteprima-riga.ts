/** ── L'ANTEPRIMA DELLA RIGA: L'ULTIMO MESSAGGIO, E DI CHI È (30/10/2026) ──────
 *
 *  Richiesta del titolare: nell'elenco si vede l'ULTIMO messaggio della chat (non
 *  l'ultimo del cliente), si capisce a colpo d'occhio se l'ho scritto io o lui, e
 *  se l'ultimo è mio e lui non ha risposto la riga lo dice.
 *
 *  Funzioni PURE (niente React, niente Supabase): provate in prove/prove.mjs,
 *  gruppo «ANTEPRIMA = ULTIMO MESSAGGIO».
 *
 *  DA DOVE ARRIVA IL DATO (nessuna query nuova)
 *   · `ultimo` è `ultimoDellaChat(c.lastMessage, c.contact)` (stato.ts): il più
 *     recente fra l'ultimo messaggio letto in pagina e quello che un trigger salva
 *     sul contatto (`ultimo_messaggio_*`, con la DIREZIONE). Vale per ogni canale
 *     (ManyChat, Cloud, ponte); i doppioni del ponte non ci sono, la lettura li
 *     toglie e il trigger non li conta.
 *   · Senza `ultimo` (chat vecchia, migrazione non applicata) si ripiega sulle
 *     colonne di «Da rispondere» che il contatto ha già: l'ultima entrata. Si
 *     ripiega SOLO se è provato che l'ultimo messaggio è quella entrata; altrimenti
 *     niente testo, mai un testo inventato.
 *  ⚠️ Le regole di «Da rispondere» (chi entra, chi esce) NON stanno qui: stato.ts.
 *  ───────────────────────────────────────────────────────────────────────── */
import { attesaInChiaro } from "./stato";
import { anteprimaIn, mediaInAnteprima } from "./media";

/** Il minimo che serve di un messaggio (anche quello ricostruito dal contatto). */
export interface UltimoMessaggio {
  direction: string;
  body: string | null;
  created_at: string;
  status?: string | null;
}

/** Le colonne del contatto che servono al ripiego. */
export interface ContattoAnteprima {
  last_message_at?: string | null;
  ultimo_in_entrata_il?: string | null;
  ultimo_in_entrata_anteprima?: string | null;
}

export type Spunte = "lette" | "consegnato" | "inviato" | "errore";

export interface SenzaRisposta {
  /** «da 2 giorni», «da 3 h»: la durata in chiaro di `attesaInChiaro` (stato.ts). */
  da: string;
  /** Per la riga stretta: «da 2 g», «da 3 h», «da poco». */
  breve: string;
  /** Il momento del mio ultimo messaggio. */
  dal: string;
  /** Da un'ora o più: sotto l'ora nessuno si aspetta già una risposta, e la riga stretta
   *  non mostra la durata (resta la frase, più corta: il nome ha più posto). */
  daOre: boolean;
}

export interface AnteprimaRiga {
  /** Una riga sola, già pulita (modelli letti, media con la loro etichetta). Vuota se non si sa. */
  testo: string;
  /** Il tipo di media, per l'icona; `null` per un testo normale. */
  media: ReturnType<typeof mediaInAnteprima>["tipo"];
  /** L'ultimo messaggio l'ho scritto io. */
  mio: boolean;
  /** Le spunte, solo per i miei. */
  spunte: Spunte | null;
  /** Del cliente e da vedere: testo in grassetto scuro. */
  nonLetto: boolean;
  /** L'ultimo è mio e lui non ha scritto dopo (e non tocca a noi). */
  senzaRisposta: SenzaRisposta | null;
  /** Né un messaggio né un'ora: la riga dice «Nessun messaggio». */
  nessunMessaggio: boolean;
}

const MINUTO = 60_000;
/** Quanto possono distare l'ultimo messaggio e l'ultima entrata per essere lo stesso. */
const STESSO_MESSAGGIO_MS = MINUTO;

const ms = (x: string | null | undefined): number | null => {
  if (!x) return null;
  const t = Date.parse(x);
  return Number.isFinite(t) ? t : null;
};

/** «da 2 giorni» → «da 2 g», «da meno di 1 min» → «da poco»; il resto («da 3 h», «da 25 min») è già corto. */
function inBreve(da: string): string {
  if (da === "da meno di 1 min") return "da poco";
  return da.replace(/^da (\d+) giorn[oi]$/, "da $1 g");
}

/** L'ultimo è mio e il cliente non ha scritto dopo? Allora «senza risposta da…».
 *  Un messaggio non partito (`failed`) non conta. Se la chat è in «Da rispondere» (`inAttesa`) tocca a NOI e non si dice: due frasi
 *  opposte sulla stessa riga confondono; l'ambra di «da 18 h» basta. */
export function senzaRispostaDa(
  ultimo: Pick<UltimoMessaggio, "direction" | "created_at" | "status"> | null,
  inAttesa: boolean,
  adesso: number,
): SenzaRisposta | null {
  if (!ultimo || ultimo.direction !== "outbound" || inAttesa) return null;
  //  Non è partito: il cliente non l'ha mai visto, non ha niente a cui rispondere (la riga lo dice con l'errore).
  if (ultimo.status === "failed") return null;
  if (ms(ultimo.created_at) === null) return null; // data illeggibile: non si inventa un «da»
  const da = attesaInChiaro(ultimo.created_at, adesso);
  const breve = inBreve(da);
  return { da, breve, dal: ultimo.created_at, daOre: /^da \d+ (h|g)$/.test(breve) };
}

function spunteDi(status: string | null | undefined): Spunte {
  if (status === "read") return "lette";
  if (status === "delivered") return "consegnato";
  if (status === "failed") return "errore";
  return "inviato"; // sent, queued, o senza stato (messaggio ricostruito dal contatto)
}

export interface IngressoAnteprima {
  ultimo: UltimoMessaggio | null;
  contatto: ContattoAnteprima | null;
  /** `c.daRispondere`: serve solo come ripiego quando manca l'ultimo messaggio. */
  attesa?: { anteprima: string | null } | null;
  /** La riga è in «Da rispondere» (modo attesa o vecchia). */
  inAttesa: boolean;
  /** Fra quelle in attesa, la riga «vecchia» (oltre 7 giorni) è attenuata: niente grassetto. */
  vecchia?: boolean;
  nonLetti: number;
  adesso: number;
  /** Legge un nostro modello («[template:x]») come nella bolla; solo per le uscite. */
  testoUscita?: (body: string | null) => string;
}

/** Cosa mostra la riga: l'ultimo messaggio, di chi è, se è da leggere, se è senza risposta. */
export function anteprimaRiga(i: IngressoAnteprima): AnteprimaRiga {
  const { ultimo, contatto } = i;
  let mio = false;
  let grezzo: string | null = null;

  if (ultimo) {
    mio = ultimo.direction === "outbound";
    grezzo = mio && i.testoUscita ? i.testoUscita(ultimo.body) : ultimo.body;
  } else if (i.inAttesa && i.attesa?.anteprima) {
    // In attesa = l'ultima cosa che conta è del cliente: è la sua anteprima.
    grezzo = i.attesa.anteprima;
  } else {
    // Chat vecchia: l'ultima entrata è l'ultimo messaggio solo se l'ora lo prova
    // (o se non c'è un'ora che dica il contrario).
    const entrata = ms(contatto?.ultimo_in_entrata_il);
    const ultima = ms(contatto?.last_message_at);
    const stessa = ultima === null || (entrata !== null && Math.abs(ultima - entrata) <= STESSO_MESSAGGIO_MS);
    if (contatto?.ultimo_in_entrata_anteprima && stessa) grezzo = contatto.ultimo_in_entrata_anteprima;
  }

  //  Una riga sola: `anteprimaIn` lascia a capo e tab (nota 3 del revisore su T2).
  const testoPulito = anteprimaIn(grezzo ?? "").replace(/\s+/g, " ").trim();
  const media = mediaInAnteprima(testoPulito);

  return {
    testo: media.testo,
    media: media.tipo,
    mio,
    spunte: mio ? spunteDi(ultimo?.status) : null,
    nonLetto: !mio && media.testo !== "" && (i.nonLetti > 0 || (i.inAttesa && !i.vecchia)),
    senzaRisposta: senzaRispostaDa(ultimo, i.inAttesa, i.adesso),
    nessunMessaggio: !ultimo && media.testo === "" && !contatto?.last_message_at,
  };
}
