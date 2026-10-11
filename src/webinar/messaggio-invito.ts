/** ── «TI ASPETTO AL WEBINAR» ────────────────────────────────────────────────
 *
 *  Il messaggio con cui si invita un lead a una diretta. Modulo puro, senza
 *  React: il testo che parte a una persona vera è la cosa che vale la pena
 *  poter provare senza aprire il programma.
 *
 *  ── COME È SCRITTO ───────────────────────────────────────────────────────
 *  Si dà del tu e si chiama la persona per nome, per la stessa ragione del
 *  messaggio che chiede i dati della fattura: chi lo riceve ha già parlato con
 *  noi, non è un estraneo a cui si scrive una circolare.
 *
 *  ⚠️ E SI DICE COSA CI GUADAGNA LUI, non cosa facciamo noi. «Facciamo un
 *   webinar sul protocollo» è una nostra iniziativa, e a un invito così si
 *   risponde «ok» e non ci si va. «Rispondo alle domande, e ci puoi parlare in
 *   diretta» è una cosa che si viene a prendere — soprattutto da chi sta
 *   valutando un trattamento e ha ancora dubbi che non ha mai detto ad alta
 *   voce.
 *
 *  ⚠️ IL LINK VA IN FONDO E DA SOLO su una riga: nel mezzo di un paragrafo
 *   WhatsApp lo attacca alla punteggiatura e certi telefoni si portano dentro
 *   il punto finale, aprendo un indirizzo che non esiste.
 */

export interface InvitoWebinar {
  /** come si chiama la persona: solo il nome, si saluta con quello */
  nome?: string;
  /** il titolo della sala, come l'hai chiamata nel gestionale */
  titolo: string;
  link: string;
  /** quando comincia, già scritto in chiaro («giovedì 4 alle 21»). Se manca,
   *  l'invito vale lo stesso: la sala aspetta e si entra quando si apre. */
  quando?: string;
  /** come si presenta lo studio */
  firma?: string;
}

/** Il primo nome, con l'iniziale maiuscola. Vuoto se non lo sappiamo: «Ciao ,»
 *  con la virgola sospesa è peggio di nessun nome. */
function primoNome(n?: string): string {
  const p = String(n ?? "").trim().split(/\s+/)[0] ?? "";
  return p ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : "";
}

export function messaggioInvitoWebinar(i: InvitoWebinar): string {
  const nome = primoNome(i.nome);
  const righe: string[] = [nome ? `Ciao ${nome},` : "Ciao,"];

  //  ⚠️ L'INIZIALE MINUSCOLA. Dopo «Ciao Marco,» la frase CONTINUA, non
  //   ricomincia: «Ciao Marco, Giovedì alle 21…» è l'errore che fa sembrare il
  //   messaggio incollato da un modulo. Chi scrive il quando nel gestionale lo
  //   scrive maiuscolo perché lì è un'etichetta a sé; qui è metà di una frase.
  const quandoInFrase = i.quando
    ? i.quando.charAt(0).toLowerCase() + i.quando.slice(1)
    : "";
  righe.push(
    quandoInFrase
      ? `${quandoInFrase} faccio una diretta e mi piacerebbe averti: «${i.titolo}».`
      : `sto per fare una diretta e mi piacerebbe averti: «${i.titolo}».`,
  );
  righe.push("");
  //  ⚠️ Il motivo per cui dovrebbe esserci, non il programma della serata.
  righe.push(
    "Rispondo alle domande dal vivo, quindi se hai dei dubbi è il momento buono per toglierli — anche quelli che non si ha voglia di scrivere.",
  );
  righe.push("");
  righe.push("Si entra da qui, dal telefono o dal computer, senza installare niente:");
  //  ⚠️ Da solo su una riga: vedi la nota in testa al file.
  righe.push(i.link);
  righe.push("");
  righe.push(`A dopo!\n${i.firma || "Hair Genius Labs"}`);

  return righe.join("\n");
}
