/** ── QUANTA BANDA PRENDERSI, QUANDO NON SI È DA SOLI ───────────────────────
 *
 *  Segnalazione del committente: «se trasmettono più persone insieme va lento
 *  a scatti, sia a me che all'altro che trasmette».
 *
 *  ⚠️ NON È UN CASO, ED È ARITMETICA. Il tetto di invio si calcolava così:
 *   «l'85% di quello che la linea dichiara di reggere», per OGNI
 *   interlocutore. Con due interlocutori si chiedeva il 170% della linea, con
 *   tre il 255%: si spinge oltre quello che passa, i pacchetti si perdono, e
 *   l'immagine si impunta — da tutte e due le parti, perché la linea è una
 *   sola. Lo stesso vale per due consulenze avviate insieme sulla stessa
 *   connessione: ognuna misura la linea intera e se la prende quasi tutta.
 *
 *  ⚠️ E LA MISURA ARRIVAVA TARDI. Il tetto si rifaceva ogni dieci secondi:
 *   dieci secondi sono un'eternità di video che si impunta prima che il
 *   programma se ne accorga. Ora la sonda gira ogni due secondi e mezzo (vedi
 *   `sondaBanda` in call.tsx), e questo file dice di quanto può muoversi il
 *   tetto a ogni giro.
 *
 *  Sta fuori da `call.tsx` perché è aritmetica, e l'aritmetica si prova:
 *  sbagliarla non rompe niente in modo visibile — viene solo un video che si
 *  impunta, e si dà la colpa alla linea.
 */

/** Sotto questo tetto non si scende mai: meglio un'immagine povera che
 *  nessuna immagine. */
export const TETTO_MINIMO = 350_000;
/** Quanto della linea misurata ci si prende: il resto è respiro per i picchi,
 *  per l'audio e per i rinvii dei pacchetti persi. */
export const QUOTA_LINEA = 0.85;
/** Quando la linea non si sa ancora, si parte prudenti ma non muti. */
export const TETTO_AL_BUIO = 600_000;
/** Salendo si va piano: un tetto che rimbalza su e giù fa più danni di uno
 *  basso. Scendendo invece si scende subito — è lì che il video si impunta. */
export const PASSO_IN_SALITA = 1.15;
/** ── QUANDO LA LINEA È PULITA SI RISALE IN FRETTA ──────────────────────────
 *
 *  Richiesta del committente: «ottimizza di più la velocità dello streaming e
 *  fai che vada alla massima velocità».
 *
 *  ⚠️ IL PASSO PRUDENTE SI PAGAVA SEMPRE, ANCHE QUANDO NON SERVIVA A NIENTE.
 *   Con +15% a ogni giro di sonda (due secondi e mezzo), risalire da 600 kbit
 *   a 2,5 Mbit vuol dire dieci giri, cioè VENTICINQUE SECONDI di immagine
 *   povera. E si paga a ogni singhiozzo: basta un'altra scheda che scarica un
 *   file, il tetto scende in un istante — giustamente — e poi resta basso per
 *   mezzo minuto mentre la linea è già libera. In consulenza sono i secondi in
 *   cui si mostra un capello al cliente.
 *
 *  La prudenza serve a non rimbalzare, e si rimbalza quando si spinge oltre
 *  quello che passa — cosa che si VEDE, perché i pacchetti persi si misurano
 *  (`persiSu` in `sondaBanda`). Se non si perde niente, non c'è nulla da cui
 *  guardarsi: +60% a ogni giro riporta su in tre giri invece di dieci.
 *  Appena ricompare una perdita si torna al passo piccolo, nello stesso giro.
 *
 *  ⚠️ IL TETTO NON DIVENTA PIÙ ALTO: resta sempre il minimo fra il listino e
 *   la quota della linea misurata. Cambia solo la FRETTA con cui lo si
 *   raggiunge — che è l'unica cosa che si poteva guadagnare senza rischiare di
 *   spingere oltre la linea, cioè senza rifare il difetto che questo file è
 *   nato per curare. */
export const PASSO_PULITO = 1.6;

/** Il tetto di invio verso UN interlocutore.
 *
 *  @param listino   quanto si vorrebbe mandare (la qualità scelta)
 *  @param disponibile  quanto la linea dichiara di reggere ADESSO (0 = non si sa)
 *  @param riceventi quante copie del video stanno partendo da qui
 *  @param precedente il tetto del giro prima (0 = primo giro)
 *  @param pulita  true se la sonda non misura perdite su quello che mandiamo:
 *   allora si risale in fretta (vedi PASSO_PULITO). Nel dubbio si lascia
 *   `undefined`, e si tiene il passo prudente: sbagliare per prudenza costa
 *   qualche secondo di immagine povera, sbagliare al contrario costa
 *   un'immagine che si impunta.
 */
export function tettoInvio(
  { listino, disponibile, riceventi, precedente, pulita }:
  { listino: number; disponibile: number; riceventi: number; precedente?: number; pulita?: boolean },
): number {
  const n = Math.max(1, Math.round(riceventi) || 1);
  //  ⚠️ LA DIVISIONE È IL CUORE DELLA CORREZIONE: la linea è una sola e va
  //   spartita fra le copie che partono, non promessa intera a ognuna.
  const quotaListino = Math.round(listino / n);
  const grezzo = disponibile > 0
    ? Math.min(quotaListino, Math.round((disponibile * QUOTA_LINEA) / n))
    : Math.max(quotaListino, Math.round(TETTO_AL_BUIO / n));
  const voluto = Math.max(TETTO_MINIMO, grezzo);
  const prima = Number(precedente) || 0;
  //  Si scende subito; si sale a piccoli passi, o in fretta se la linea è
  //  pulita (vedi PASSO_PULITO).
  const passo = pulita ? PASSO_PULITO : PASSO_IN_SALITA;
  if (prima > 0 && voluto > prima) return Math.max(TETTO_MINIMO, Math.min(voluto, Math.round(prima * passo)));
  return voluto;
}

/** Di quanto rimpicciolire l'immagine inviata quando le copie sono più d'una.
 *  ⚠️ In rete a maglia ogni copia si CODIFICA a parte: con tre interlocutori
 *   il computer codifica tre video, e la CPU è la prima a cedere. Un'immagine
 *   più piccola costa molto meno e si vede uguale in un cerchio o in un
 *   riquadro da telefono. */
export function scalaMesh(riceventi: number): number {
  const n = Math.max(1, Math.round(riceventi) || 1);
  if (n >= 4) return 2.5;
  if (n === 3) return 2;
  if (n === 2) return 1.5;
  return 1;
}

/** Quanti fotogrammi al secondo mandare con più interlocutori.
 *  Si tocca solo da tre in su: meglio meno fotogrammi stabili che trenta
 *  promessi e quindici consegnati a strappi. */
export function fotogrammiMesh(fr: number, riceventi: number): number {
  const n = Math.max(1, Math.round(riceventi) || 1);
  const base = Number(fr) > 0 ? Math.round(Number(fr)) : 30;
  if (n >= 4) return Math.min(base, 18);
  if (n === 3) return Math.min(base, 24);
  return base;
}

/** Di quanto rimpicciolire l'immagine quando il tetto è molto sotto al listino.
 *
 *  ⚠️ È LA LEVA CHE MANCAVA. Abbassare i bit senza abbassare i pixel dà il
 *   peggio dei due mondi: l'encoder deve descrivere 1280×720 con la banda di
 *   un francobollo, quindi butta fotogrammi — ed è esattamente «va lento a
 *   scatti». Con la stessa banda su un'immagine più piccola i fotogrammi
 *   restano tutti, e in una consulenza la fluidità del viso conta più della
 *   definizione.
 *  Succede da solo appena la linea torna libera: è un tetto, non una
 *  punizione. */
export function scalaPerTetto(tetto: number, listino: number): number {
  const t = Number(tetto) || 0, l = Number(listino) || 0;
  if (t <= 0 || l <= 0) return 1;
  const quota = t / l;
  if (quota >= 0.6) return 1;      // c'è banda: immagine intera
  if (quota >= 0.3) return 1.5;
  return 2;
}

/** ── QUANTO CHIEDE DAVVERO UNA CAMERA ──────────────────────────────────────
 *
 *  Domanda del committente: «non c'è un modo perché entrambi possano usare
 *  Alta?». C'è, e sta qui.
 *
 *  «Alta» vuol dire 1280×720: è la RISOLUZIONE, cioè quello che si vede. I
 *  2,5 Mbit al secondo non sono la qualità, sono il tetto di spesa — ed erano
 *  dimensionati per un'immagine piena di movimento. Un viso che parla non lo
 *  è: sta fermo, lo sfondo non cambia, e ciò che il codificatore deve
 *  descrivere a ogni fotogramma è pochissimo. A 720p un mezzo busto sta
 *  comodo in un terzo in meno di banda, e nessuno vede la differenza.
 *
 *  ⚠️ LA CONDIVISIONE SCHERMO È UN'ALTRA COSA. Lì ci sono testo e linee
 *   sottili: abbassare il tetto significa lettere che sbavano. Quella tiene
 *   il tetto pieno.
 *
 *  Il conto per cui è stato fatto: due consulenze insieme passano da 5 Mbit
 *  in salita (che quasi nessun ufficio ha liberi) a poco più di 3.
 */
export const FATTORE_CAMERA = 0.64;
export function listinoVideo(listino: number, condivideSchermo: boolean): number {
  const l = Number(listino) || 0;
  if (l <= 0) return TETTO_MINIMO;
  if (condivideSchermo) return l;
  return Math.max(TETTO_MINIMO, Math.round(l * FATTORE_CAMERA));
}
