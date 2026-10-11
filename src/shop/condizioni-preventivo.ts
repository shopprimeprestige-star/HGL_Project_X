/** ── LE CONDIZIONI CON CUI UN PREVENTIVO È NATO ────────────────────────────
 *
 *  Richiesta del committente: «se un preventivo lo faccio con le opzioni
 *  accese o con determinati prezzi, rimangono quei prezzi e quelle
 *  impostazioni — a meno che non faccia "modifica preventivo", e allora si
 *  aggiorna con le nuove condizioni».
 *
 *  ── PERCHÉ SERVIVA ───────────────────────────────────────────────────────
 *  Il preventivo salvato contiene le VOCI e i loro prezzi, ma non il resto di
 *  quello che c'era a schermo: quanto costa l'assistenza dopo la consegna, di
 *  quanti mesi è la copertura, quant'è l'acconto, quali pezzi della pagina
 *  erano accesi. Tutta quella roba la pagina la rileggeva dal listino di
 *  ADESSO — e il listino cambia. Bastava ritoccare l'assistenza il giorno dopo
 *  perché il documento che il cliente aveva in mano ne mostrasse un'altra, o
 *  perché un riquadro spento nel frattempo sparisse da un preventivo emesso
 *  quando c'era. Un documento che cambia da solo dopo essere stato consegnato
 *  non è un documento.
 *
 *  Qui si fotografa il listino intero nel momento in cui il preventivo nasce,
 *  insieme alle scelte fatte. Da lì in avanti quel preventivo si disegna con la
 *  sua fotografia, non con il listino di oggi.
 *
 *  ── E LE SCELTE, PER ID ──────────────────────────────────────────────────
 *  Richiesta del committente: «se faccio modifica preventivo, riseleziona
 *  tutte le opzioni che avevo selezionato nel preventivo».
 *  Riaprire una configurazione dai NOMI delle voci (shop/riapri-preventivo)
 *  funziona finché i nomi non cambiano: basta una parola ritoccata nel listino
 *  perché quella voce non si ritrovi più e torni indietro un preventivo più
 *  povero di com'era. Qui accanto al nome c'è l'ID, che non cambia mai, e la
 *  riapertura diventa esatta. I nomi restano per una ragione sola: se una voce
 *  dal listino è stata TOLTA, bisogna poter dire QUALE non è tornata.
 *
 *  ⚠️ «MODIFICA PREVENTIVO» BUTTA VIA LA FOTOGRAFIA, ed è il punto della
 *   richiesta: da lì in poi si lavora con le condizioni di oggi — prezzi
 *   nuovi, assistenza nuova, voci nuove — e il documento che nascerà avrà la
 *   sua fotografia nuova.
 *  ⚠️ QUI NON SI LEGGE E NON SI SCRIVE NIENTE: si costruisce e si rilegge un
 *   oggetto. Il giro sul database lo fanno le rotte (quote-create la scrive,
 *   quote la restituisce), e così questa regola si prova senza database
 *   (vedi proveDelleCondizioni).
 *  ───────────────────────────────────────────────────────────────────────── */
import { ACCONTO_DI_CASA, type PricingOverrides } from "./quote-menu";

/** Una voce spuntata: l'id per ritrovarla, il nome per poterla nominare se
 *  nel frattempo è sparita dal listino. */
export interface VoceScelta {
  id: string;
  nome: string;
}

export interface ScelteFatte {
  baseId: string;
  voci: VoceScelta[];
  /** id della voce → id della sotto-scelta (il «Mosso — onda media»). */
  varianti: Record<string, string>;
  simOn: boolean;
  installOn: boolean;
  installLoc: "studio" | "home";
  fitting: string;
  qty: number;
}

export interface CondizioniPreventivo {
  /** Il listino com'era: prezzi, voci spente, assistenza, acconto. */
  listino: PricingOverrides;
  /** Che cosa era spuntato. Assente sui preventivi nati prima di oggi: allora
   *  si riapre dai nomi, come si è sempre fatto. */
  scelte?: ScelteFatte;
  /** Quando è stata scattata la fotografia (ISO). Serve solo a chi guarda i
   *  dati: non entra in nessuna decisione. */
  il?: string;
}

/** La base della chiave in `app_config`: la riga vera è
 *  `preventivo_condizioni:<NUMERO>` (vedi `chiaveSessione`). */
export const BASE_CONDIZIONI = "preventivo_condizioni";

const testo = (v: unknown): string => String(v ?? "").trim();

/** La fotografia da salvare insieme al preventivo. */
export function condizioniDa(
  listino: PricingOverrides,
  scelte?: ScelteFatte,
  adesso: Date = new Date(),
): CondizioniPreventivo {
  return {
    listino: listino ?? {},
    ...(scelte ? { scelte } : {}),
    il: adesso.toISOString(),
  };
}

/** Rilegge la fotografia difendendosi da tutto: la scrive una versione della
 *  pagina, la rilegge un'altra, e in mezzo c'è un campo di testo di un
 *  database. Una riga illeggibile non deve impedire di aprire un preventivo —
 *  si torna al listino di oggi, che è come ci si comportava prima. */
export function leggiCondizioni(grezzo?: string | null): CondizioniPreventivo | null {
  if (!grezzo) return null;
  try {
    const v = JSON.parse(grezzo) as Partial<CondizioniPreventivo>;
    if (!v || typeof v !== "object" || !v.listino || typeof v.listino !== "object") return null;
    const s = v.scelte;
    const scelte: ScelteFatte | undefined =
      s && typeof s === "object"
        ? {
            baseId: testo(s.baseId),
            voci: Array.isArray(s.voci)
              ? s.voci
                  .map((x) => ({ id: testo((x as VoceScelta)?.id), nome: testo((x as VoceScelta)?.nome) }))
                  .filter((x) => !!x.id)
              : [],
            varianti: s.varianti && typeof s.varianti === "object" ? { ...s.varianti } : {},
            simOn: !!s.simOn,
            //  ⚠️ L'installazione di serie è ACCESA: una fotografia scritta
            //   male non deve togliere dal preventivo riaperto una voce che
            //   c'era (e che si paga).
            installOn: s.installOn !== false,
            installLoc: s.installLoc === "home" ? "home" : "studio",
            fitting: testo(s.fitting) || "remoto",
            qty: Number(s.qty) > 0 ? Math.round(Number(s.qty)) : 1,
          }
        : undefined;
    return {
      listino: v.listino as PricingOverrides,
      ...(scelte ? { scelte } : {}),
      ...(typeof v.il === "string" ? { il: v.il } : {}),
    };
  } catch {
    return null;
  }
}

/** ── I DOCUMENTI NATI PRIMA DELLA FOTOGRAFIA ──────────────────────────────
 *
 *  Segnalazione del committente: «quando l'opzione garanzia 15 mesi è spenta,
 *  dai preventivi già creati CON la garanzia la toglie: invece deve lasciarla
 *  lì. Solo su quelli creati senza quell'opzione attiva non deve comparire».
 *  E, sullo stesso punto: «anche l'acconto deve restare quello del momento in
 *  cui il preventivo è stato creato».
 *
 *  I preventivi nati da questa versione in poi si portano dietro la loro
 *  fotografia e il problema non si pone. Quelli di PRIMA no, e per loro la
 *  pagina ricadeva sul listino di adesso: spegnendo l'assistenza spariva anche
 *  dai documenti emessi quando c'era — cioè una promessa già consegnata al
 *  cliente che si cancella da sola.
 *
 *  Di quei documenti non sappiamo tutto, ma due cose le sappiamo per certo:
 *   · NESSUNO di loro poteva essere stato emesso con l'assistenza spenta,
 *     perché l'interruttore non esisteva. Quindi gli spegnimenti di oggi non
 *     li riguardano: nessuna parte della pagina si toglie retroattivamente.
 *   · L'ACCONTO al momento della creazione era cento euro, perché fino a ieri
 *     era scritto nel codice e non si poteva cambiare.
 *  Il resto (i prezzi delle voci) sta già nella riga del preventivo, e la
 *  cifra dell'assistenza di allora non la sa nessuno: lì vale quella di oggi,
 *  che è come questa pagina si è sempre comportata.
 *
 *  ⚠️ VALE SOLO PER UN DOCUMENTO GIÀ EMESSO. Nel configuratore — dove il
 *   preventivo si sta ancora costruendo — comanda il listino di adesso, con i
 *   suoi spegnimenti e il suo acconto: è lì che le impostazioni nuove devono
 *   vedersi subito. */
export function listinoDiUnDocumentoVecchio(oggi: PricingOverrides): PricingOverrides {
  return { ...oggi, spente: {}, acconto: ACCONTO_DI_CASA };
}

/** Con quale listino si disegna questo preventivo: la sua fotografia se ce
 *  l'ha; se non ce l'ha ma è un documento già emesso, quello di oggi senza le
 *  cose che non possono valere all'indietro (vedi sopra); altrimenti — cioè
 *  nel configuratore — quello di oggi e basta.
 *  ⚠️ `condizioni` a `null` vuol dire due cose diverse: «non c'è una
 *   fotografia» (preventivo vecchio) e «la stiamo buttando via apposta»
 *   (modifica preventivo). Le distingue `documentoEmesso`: premendo «modifica»
 *   si torna al configuratore, e lì vale il listino di adesso per intero. */
export function listinoDelPreventivo(
  condizioni: CondizioniPreventivo | null | undefined,
  oggi: PricingOverrides,
  documentoEmesso = false,
): PricingOverrides {
  if (condizioni) return condizioni.listino;
  return documentoEmesso ? listinoDiUnDocumentoVecchio(oggi) : oggi;
}
