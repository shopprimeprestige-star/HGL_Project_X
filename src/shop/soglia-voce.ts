/** ── LA SOGLIA DELLA VOCE, QUANDO PARLA ANCHE L'ALTRO ─────────────────────
 *
 *  Segnalazione del committente: «quando sono su Meetly e l'audio si disattiva
 *  dell'altro: quando uno parla si rovina la trasmissione audio dell'altro».
 *
 *  ⚠️ COSA SUCCEDE DAVVERO, ED È UN CLASSICO DELLE CHIAMATE A VIVAVOCE.
 *   Il microfono di ciascuno ha una soglia: sotto un certo livello non
 *   trasmette, così il rumore della stanza non arriva dall'altra parte. Ma
 *   mentre l'altro parla, la sua voce ESCE DAGLI ALTOPARLANTI e rientra nel
 *   nostro microfono. Per la soglia quell'eco è «voce»: la porta si apre e
 *   rimandiamo indietro la voce dell'altro con un ritardo. Chi parla si sente
 *   tornare addosso, spezzettato — «si rovina la trasmissione».
 *   E c'era di peggio: la valvola di sicurezza («c'è voce ma la porta non si
 *   apre da tre secondi → spengo la soglia») scambiava l'eco per voce e
 *   SPEGNEVA la soglia a chi stava solo ascoltando. Da quel momento l'eco
 *   passava sempre.
 *
 *  Il rimedio è quello che fa ogni impianto a vivavoce: finché parla l'altro,
 *  per aprire serve una voce VICINA. L'eco che torna da un altoparlante è
 *  molto più debole di chi parla davanti al microfono, e questa differenza è
 *  tutto ciò che serve per distinguerli.
 *
 *  Sta fuori da `call.tsx` perché è aritmetica, e l'aritmetica si prova.
 */

/** Quanto più forte deve essere la voce per aprire mentre parla l'altro.
 *  Dodici decibel sono circa quattro volte l'ampiezza: una voce a un braccio
 *  dal microfono li ha di margine su un'eco da altoparlante di portatile, e
 *  chi parla davvero continua a passare senza accorgersi di niente. */
export const MARGINE_ECO_DB = 12;

/** Il livello che serve per APRIRE la voce adesso.
 *  @param gateDb    la soglia scelta nelle impostazioni (es. −45)
 *  @param altriParlano  true se in questo istante sta parlando qualcun altro
 */
export function sogliaApertura(gateDb: number, altriParlano: boolean): number {
  const base = Number.isFinite(gateDb) ? gateDb : -45;
  return altriParlano ? base + MARGINE_ECO_DB : base;
}

/** La valvola di sicurezza può spegnere la soglia?
 *
 *  ⚠️ NON mentre parla l'altro: quella «voce» che non riesce ad aprire è quasi
 *   sempre la sua eco, e spegnere la soglia vorrebbe dire rimandargliela
 *   indietro per tutta la consulenza. La valvola serve a non restare muti
 *   mentre si parla, e chi sta ascoltando non sta parlando.
 */
export function valvolaPuoSpegnere(
  { livelloDb, gateAperta, altriParlano }:
  { livelloDb: number; gateAperta: boolean; altriParlano: boolean },
): boolean {
  if (gateAperta || altriParlano) return false;
  return livelloDb > -55;
}
