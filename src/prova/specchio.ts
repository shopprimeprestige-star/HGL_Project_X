/** ── LO SPECCHIO DELLA PROVA CAPELLI ───────────────────────────────────────
 *
 *  In videoconsulenza la prova capelli si fa in due: il cliente ha il telefono
 *  (e quindi la faccia), il consulente ha il mestiere. Finché le due schermate
 *  erano indipendenti, quello che il cliente toccava non si vedeva dall'altra
 *  parte — e il consulente doveva dettare al telefono «no, quello sotto, no
 *  l'altro», che è esattamente la cosa che una videoconsulenza dovrebbe
 *  evitare.
 *
 *  Qui c'è la parte che si può provare senza browser: la firma di uno stato,
 *  la decisione se una notizia va applicata, e il passo che si può davvero
 *  mostrare. Il giro di rete sta nella pagina.
 *
 *  ── ⚠️ PERCHÉ LA FOTO NON È IN QUESTO ELENCO ─────────────────────────────
 *  Sulla prima schermata c'è scritto, a chiare lettere, che la foto non viene
 *  salvata e resta sul dispositivo: è la promessa che convince una persona a
 *  mandare la propria faccia. Mandarla al server per rispecchiarla la
 *  romperebbe. Il RISULTATO invece viaggia: quello sta già su Storage — è ciò
 *  che permette di riaprire un link — e mostra la stessa faccia coi capelli.
 */
export interface StatoSpecchio {
  passo: string;
  taglio: string;
  colore: string;
  barba: boolean;
  esito: string;
  /** vero mentre l'immagine si sta generando dall'altra parte */
  carico: boolean;
  /** contatore: cresce quando il consulente chiede «genera» al telefono */
  genera: number;
  /** chi ha scritto: `guida` (consulente) oppure `ospite` (cliente) */
  da: string;
  /** momento della scrittura: serve a non applicare due volte la stessa */
  v: number;
}

export type Ruolo = "guida" | "ospite";

/** Il pezzo che conta di uno stato: se questa non cambia, non si manda niente.
 *  ⚠️ Senza, ogni giro di orologio riscriverebbe lo stesso stato e le due
 *   schermate si rimbalzerebbero le notizie all'infinito. */
export function firmaStato(s: Partial<StatoSpecchio>): string {
  return [
    s.passo ?? "",
    s.taglio ?? "",
    s.colore ?? "",
    s.barba ? "1" : "0",
    s.esito ?? "",
    s.carico ? "1" : "0",
    String(s.genera ?? 0),
  ].join("|");
}

/** Va applicata questa notizia?
 *  ⚠️ Tre no, e ognuno è un difetto vero evitato:
 *   · è nostra → è l'eco di quello che abbiamo appena mandato;
 *   · è vecchia → arrivano fuori ordine e quella di prima cancellerebbe l'ultima;
 *   · è uguale a quello che vediamo → un ridisegno per niente, e su un telefono
 *     un ridisegno per niente si vede.
 */
export function daApplicare(
  remoto: Partial<StatoSpecchio> | null | undefined,
  chi: { ruolo: Ruolo; ultimaVersione: number; firmaLocale: string },
): boolean {
  if (!remoto || !remoto.da) return false;
  if (remoto.da === chi.ruolo) return false;
  if (Number(remoto.v || 0) <= chi.ultimaVersione) return false;
  return firmaStato(remoto) !== chi.firmaLocale;
}

/** Il passo che si può davvero mostrare da questa parte.
 *  ⚠️ Il consulente può essere sul risultato mentre il telefono del cliente non
 *   ha ancora niente da mostrare: portarlo lì vorrebbe dire una schermata vuota
 *   col titolo «Il risultato». In quel caso ci si ferma al colore, che è il
 *   passo da cui si genera. */
export function passoDaMostrare(
  passoRemoto: string,
  qui: { ruolo: Ruolo; haEsito: boolean; haFoto: boolean },
): string {
  //  Il risultato c'è: si guarda, da qualunque parte si stia.
  if (qui.haEsito && passoRemoto === "risultato") return "risultato";
  /** ── ⚠️ IL CLIENTE SENZA FOTO RESTA A FARE LA FOTO ────────────────────
   *  Il consulente sfoglia i tagli mentre il cliente non si è ancora
   *  fotografato: trascinarlo sulla vetrina gli toglie di mezzo l'unica cosa
   *  che deve fare, e la prova non parte più. Lui resta sulla fotocamera, il
   *  consulente intanto guarda quello che vuole. */
  if (qui.ruolo === "ospite" && !qui.haFoto) return "foto";
  //  ⚠️ E il consulente non finisce sulla fotocamera: la foto non è sua, e
  //   quella schermata gli toglierebbe di vista quello che il cliente sceglie.
  if (passoRemoto === "foto") return "taglio";
  //  Il risultato senza risultato è una schermata vuota col titolo pieno: ci
  //  si ferma al colore, che è il passo da cui si genera.
  if (passoRemoto === "risultato") return "colore";
  return passoRemoto;
}

/** Chi esegue davvero un «genera» arrivato dall'altra parte.
 *  ⚠️ SOLO IL TELEFONO DEL CLIENTE. La foto è là: se generasse anche il
 *   consulente — che magari ne ha caricata una sua per far vedere com'è —
 *   partirebbero due immagini e si pagherebbero due volte per un solo gesto. */
export function deveGenerare(ruolo: Ruolo, haFoto: boolean): boolean {
  return ruolo === "ospite" && haFoto;
}
