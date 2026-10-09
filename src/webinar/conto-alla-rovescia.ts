/** ── QUANTO MANCA ──────────────────────────────────────────────────────────
 *
 *  Il conto alla rovescia della sala d'attesa. Sembra banale e non lo è: la
 *  parte difficile non è sottrarre due date, è decidere COSA MOSTRARE.
 *
 *  ⚠️ LE VOCI A ZERO NON SI MOSTRANO — MA SOLO QUELLE IN TESTA.
 *   «0 giorni · 0 ore · 12 minuti» è il modo più efficace di far sembrare
 *   lontana una cosa che comincia fra dodici minuti: l'occhio legge il primo
 *   numero, e il primo numero è zero. Si parte dalla voce più grande che vale
 *   qualcosa e si scende.
 *   ⚠️ Ma NON si tolgono gli zeri in mezzo: con «2 giorni · 0 ore · 5 minuti»,
 *    togliere le ore lascia «2 giorni · 5 minuti», che si legge male e per un
 *    istante sembra dire un'altra cosa. Gli zeri interni restano.
 *
 *  ⚠️ MINUTI E SECONDI CI SONO SEMPRE, anche a zero. Quando manca meno di un
 *   minuto, un conto che mostra i soli secondi che scendono — «43», «42» — non
 *   si riconosce nemmeno come un orologio. «00 : 43» sì.
 *
 *  ⚠️ E QUANDO L'ORA È PASSATA NON SI CONTA ALL'INSÙ. Un webinar che comincia
 *   con dieci minuti di ritardo — cioè quasi sempre — mostrerebbe «-00:10:23»,
 *   che è la cosa peggiore da far vedere a duecento persone in attesa: dice che
 *   qualcosa non ha funzionato. Si dice invece che sta per cominciare.
 */

export type Voce = "giorni" | "ore" | "minuti" | "secondi";

export interface Rimanente {
  giorni: number;
  ore: number;
  minuti: number;
  secondi: number;
  /** l'ora prevista è già passata: non si conta all'insù, si aspetta */
  passato: boolean;
  /** quali voci mostrare, nell'ordine in cui si leggono */
  voci: Voce[];
}

/** @param quando  l'ora prevista, in ISO. Vuota o illeggibile = `null`, e chi
 *   chiama mostra la schermata d'attesa senza conto: meglio nessun numero che
 *   un numero inventato.
 *  @param adesso  il momento presente in millisecondi. Si passa da fuori
 *   apposta: una funzione che legge l'orologio da sé non si può mettere alla
 *   prova, e questa è tutta fatta di casi limite. */
export function quantoManca(quando: string | null | undefined, adesso: number): Rimanente | null {
  const t = Date.parse(String(quando ?? ""));
  if (!Number.isFinite(t)) return null;

  const delta = t - adesso;
  if (delta <= 0) {
    return { giorni: 0, ore: 0, minuti: 0, secondi: 0, passato: true, voci: ["minuti", "secondi"] };
  }

  const secondiTotali = Math.floor(delta / 1000);
  const giorni = Math.floor(secondiTotali / 86_400);
  const ore = Math.floor((secondiTotali % 86_400) / 3_600);
  const minuti = Math.floor((secondiTotali % 3_600) / 60);
  const secondi = secondiTotali % 60;

  //  Dalla più grande che vale qualcosa in giù. Minuti e secondi non si
  //  tolgono mai: vedi la nota in testa.
  const voci: Voce[] = giorni > 0
    ? ["giorni", "ore", "minuti", "secondi"]
    : ore > 0
      ? ["ore", "minuti", "secondi"]
      : ["minuti", "secondi"];

  return { giorni, ore, minuti, secondi, passato: false, voci };
}

/** Il valore di una voce, già a due cifre dove serve.
 *  ⚠️ I giorni NON si imbottiscono di zeri: «03 giorni» sembra il numero di
 *   serie di qualcosa. Ore, minuti e secondi sì, perché sono un orologio e un
 *   orologio ha sempre due cifre — e senza, la riga cambia larghezza a ogni
 *   secondo e balla. */
export function valore(r: Rimanente, v: Voce): string {
  const n = v === "giorni" ? r.giorni : v === "ore" ? r.ore : v === "minuti" ? r.minuti : r.secondi;
  return v === "giorni" ? String(n) : String(n).padStart(2, "0");
}

/** Come si chiama una voce, al singolare quando vale uno. «1 giorni» è la
 *  scritta che fa capire a chi legge che nessuno ci ha guardato. */
export function etichetta(r: Rimanente, v: Voce): string {
  const n = v === "giorni" ? r.giorni : v === "ore" ? r.ore : v === "minuti" ? r.minuti : r.secondi;
  if (v === "giorni") return n === 1 ? "giorno" : "giorni";
  if (v === "ore") return n === 1 ? "ora" : "ore";
  if (v === "minuti") return n === 1 ? "minuto" : "minuti";
  return n === 1 ? "secondo" : "secondi";
}

/** ── LA FRASE SOPRA IL CONTO ───────────────────────────────────────────────
 *  Cambia con la distanza, perché a distanze diverse servono cose diverse:
 *  a giorni si torna dopo (e va detto), a minuti si resta.
 *  ⚠️ Nessuna promessa sull'orario esatto quando l'ora è passata: «comincia
 *   fra poco» è vero, «comincia adesso» no — e chi lo legge per tre minuti di
 *   fila smette di credere a tutto il resto. */
export function frase(r: Rimanente | null): string {
  if (!r) return "La diretta comincerà a breve.";
  if (r.passato) return "Sta per cominciare: resta qui, parte da sola.";
  if (r.giorni > 0) return "Segna il giorno: ti basta riaprire questo link.";
  if (r.ore > 0) return "Torna a quest'ora: la pagina parte da sola.";
  return "Manca poco. Resta qui: comincia da sola, senza ricaricare.";
}
