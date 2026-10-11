import type { InPalco, RegiaPalco } from "./tipi";

/** ── GOVERNARE IL PALCO: UNA LISTA DI PERSONE, NON UN NUMERO ───────────────
 *
 *  ⚠️ QUI C'ERANO «1 2 3 4 · Tutti», e contavano invece di far scegliere.
 *   Erano sbagliati alla radice, non nel disegno:
 *    · con «2» non decidi CHI va in onda — decidi quanti, e la scelta la fa
 *      l'ordine di arrivo. Se volevi il secondo e il quarto non c'era modo;
 *    · quando qualcuno sale o scende, «2» continua a dire due, ma sono due
 *      PERSONE DIVERSE: il montaggio cambia da solo, senza che nessuno abbia
 *      toccato niente, e chi conduce lo scopre guardando la sala;
 *    · non si vedeva chi era dentro e chi fuori. Un comando che non mostra il
 *      suo effetto va ricordato a memoria, e in diretta non si ricorda niente.
 *
 *   Adesso il palco è quello che è: un elenco di persone, ciascuna con due
 *   stati — si vede o no, è grande o no — e ogni gesto tocca UNA persona sola.
 *
 *  ⚠️ E LE REGOLE STANNO QUI, non nel disegno: erano sparse fra la console e i
 *   suoi tasti, e fra loro potevano contraddirsi. È già successo — «in onda 1»
 *   più un primo piano su un altro davano una regia che mostrava una cosa e
 *   una sala che ne mostrava un'altra.
 */

/** Chi conduce, nell'elenco dei mostrati, si chiama così. */
export const IO = "io";

export interface RigaRegia {
  chiave: string;
  nome: string;
  /** la sala lo vede? */
  inOnda: boolean;
  /** è lui il riquadro grande (primo piano o faccia a faccia)? */
  grande: boolean;
  /** è chi conduce? non si può togliere né far scendere */
  sonoIo: boolean;
}

/** Tutte le chiavi che POTREBBERO andare in onda, nell'ordine giusto: prima
 *  chi conduce, poi chi è salito, nell'ordine in cui è salito. */
export function tuttiSulPalco(palco: readonly InPalco[]): string[] {
  return [IO, ...palco.filter((p) => p.stato !== "attesa").map((p) => p.spettatore)];
}

/** L'elenco da mostrare nella barra della regia.
 *  ⚠️ `mostrati` ASSENTE vuol dire «si vedono tutti», e non «nessuno»: è il
 *   caso normale, quello di una diretta appena cominciata. */
export function elencoRegia(
  regia: RegiaPalco | undefined,
  palco: readonly InPalco[],
): RigaRegia[] {
  const chiavi = tuttiSulPalco(palco);
  const mostrati = Array.isArray(regia?.mostrati) ? regia!.mostrati : null;
  const grande = regia?.facciaAFaccia || regia?.primoPiano || "";
  return chiavi.map((chiave) => ({
    chiave,
    nome: chiave === IO ? "Tu" : palco.find((p) => p.spettatore === chiave)?.nome || "Ospite",
    inOnda: !mostrati || mostrati.includes(chiave),
    grande: chiave === grande,
    sonoIo: chiave === IO,
  }));
}

/** ⚠️ Se l'elenco esplicito contiene TUTTI, si torna ad «assente». Non è una
 *  pulizia: è la differenza fra una sala viva e una sala congelata. Con un
 *  elenco fisso che per caso li contiene tutti, il PROSSIMO che sale non ci
 *  sarebbe dentro e non comparirebbe mai — e chi conduce non avrebbe modo di
 *  sospettarlo, perché in quel momento a schermo tornano proprio tutti. */
function semplifica(mostrati: string[], tutti: readonly string[]): string[] | undefined {
  const dentro = new Set(mostrati);
  return tutti.every((k) => dentro.has(k)) ? undefined : mostrati;
}

/** Mette o toglie UNA persona dalla diretta.
 *  ⚠️ Chi conduce non si può togliere: è l'unico riquadro che non deve poter
 *   sparire, e una sala senza nessuno in onda è una sala nera. */
export function conInOnda(
  regia: RegiaPalco | undefined,
  palco: readonly InPalco[],
  chiave: string,
  acceso: boolean,
): RegiaPalco {
  const base = regia ?? {};
  if (chiave === IO && !acceso) return base;
  const tutti = tuttiSulPalco(palco);
  const partenza = Array.isArray(base.mostrati) ? base.mostrati : tutti;
  const nuovi = acceso
    ? tutti.filter((k) => partenza.includes(k) || k === chiave)
    : partenza.filter((k) => k !== chiave);
  const fuori = !acceso && chiave !== IO;
  return {
    ...base,
    mostrati: semplifica(nuovi, tutti),
    //  ⚠️ Chi esce dalla diretta non può restare «grande»: sarebbe un riquadro
    //   grande su una persona che la sala non vede, cioè un rettangolo nero
    //   nel posto più visibile dello schermo.
    ...(fuori && base.primoPiano === chiave ? { primoPiano: "" } : {}),
    ...(fuori && base.facciaAFaccia === chiave ? { facciaAFaccia: undefined } : {}),
  };
}

/** Mette (o toglie) il riquadro grande su una persona.
 *  ⚠️ Metterlo grande lo manda anche IN ONDA: «voglio vedere bene questa
 *   persona» non può convivere con «questa persona non si vede». Erano due
 *   comandi indipendenti e si sono contraddetti davvero. */
export function conGrande(
  regia: RegiaPalco | undefined,
  palco: readonly InPalco[],
  chiave: string,
): RegiaPalco {
  const base = regia ?? {};
  const eraGrande = (base.facciaAFaccia || base.primoPiano || "") === chiave;
  if (eraGrande) return { ...base, primoPiano: "", facciaAFaccia: undefined };
  const conLuiInOnda = conInOnda(base, palco, chiave, true);
  return chiave === IO
    //  ⚠️ Chi conduce «grande» vuol dire semplicemente NESSUN faccia a faccia:
    //   il suo posto è già il primo, e un montaggio a due con sé stessi non
    //   esiste.
    ? { ...conLuiInOnda, primoPiano: "", facciaAFaccia: undefined }
    : { ...conLuiInOnda, primoPiano: chiave, facciaAFaccia: chiave };
}

/** Tutti in onda: si torna al caso normale, quello in cui anche chi sale dopo
 *  compare da solo. */
export function conTutti(regia: RegiaPalco | undefined): RegiaPalco {
  const { mostrati: _via, ...resto } = regia ?? {};
  return resto;
}

/** Solo chi conduce. Nessuno scende: restano sul palco, collegati e con il
 *  microfono com'era — semplicemente la sala non li vede. */
export function conSoloIo(regia: RegiaPalco | undefined): RegiaPalco {
  return { ...(regia ?? {}), mostrati: [IO], primoPiano: "", facciaAFaccia: undefined };
}
