/** ── SCRIVERE «@» E TROVARE UNA PERSONA ────────────────────────────────────
 *
 *  Il pezzo di logica dietro l'elenco che si apre scrivendo «@» in chat. Sta
 *  fuori dalla schermata perché è fatto quasi solo di casi limite — dove
 *  comincia il tag, quando smette di essere un tag, che cosa succede se uno
 *  scrive «@» in mezzo a una parola — e un caso limite dentro una vista non si
 *  può mettere alla prova.
 *
 *  ⚠️ IL TAG SI CHIUDE DA SOLO QUANDO NON HA PIÙ SENSO. Il difetto tipico di
 *   questi elenchi è restare aperti: uno scrive «@mario ciao come stai» e
 *   l'elenco è ancora lì a cercare «mario ciao come stai» fra i presenti,
 *   coprendo la conversazione. Qui uno SPAZIO chiude il tag — i nomi con lo
 *   spazio si scelgono dall'elenco, non si scrivono.
 */

export interface Tag {
  /** posizione della «@» nel testo */
  inizio: number;
  /** quello che è stato scritto dopo la «@» */
  cerca: string;
}

/** C'è un tag aperto sotto il cursore? `null` = no, e l'elenco resta chiuso.
 *  @param testo    il contenuto del campo
 *  @param cursore  dove sta il cursore (selectionStart) */
export function tagAperto(testo: string, cursore: number): Tag | null {
  const s = String(testo ?? "");
  const c = Math.max(0, Math.min(cursore ?? 0, s.length));
  //  Si cammina all'indietro dal cursore fino alla «@» più vicina.
  for (let i = c - 1; i >= 0; i--) {
    const ch = s[i];
    //  ⚠️ UNO SPAZIO CHIUDE IL TAG. Senza questa riga l'elenco resterebbe
    //   aperto per tutto il resto del messaggio.
    if (ch === " " || ch === "\n") return null;
    if (ch !== "@") continue;
    //  ⚠️ LA «@» DEVE COMINCIARE UNA PAROLA. In «mario@posta.it» non si sta
    //   citando nessuno: si sta scrivendo un indirizzo, e aprire l'elenco lì
    //   copre quello che si sta scrivendo.
    const prima = i > 0 ? s[i - 1] : " ";
    if (prima !== " " && prima !== "\n") return null;
    return { inizio: i, cerca: s.slice(i + 1, c) };
  }
  return null;
}

/** ── CHI CORRISPONDE, E IN CHE ORDINE ──────────────────────────────────────
 *  ⚠️ CHI COMINCIA COL PEZZO SCRITTO VIENE PRIMA di chi lo contiene in mezzo.
 *   Scrivendo «ma», «Marco» deve stare sopra «Gianmaria»: si scrive l'inizio di
 *   un nome, non un pezzo a caso, e trovarsi in cima uno che non si stava
 *   cercando fa premere la persona sbagliata — cioè mandare a un estraneo una
 *   risposta destinata a un altro.
 *  ⚠️ Accenti e maiuscole non contano: nessuno scrive «@Nicolò» con l'accento
 *   giusto mentre segue una diretta. */
export function trovaPersone<T extends { nome: string }>(
  persone: T[],
  cerca: string,
  massimo = 6,
): T[] {
  const q = normalizza(cerca);
  if (!q) return persone.slice(0, massimo);
  const inizia: T[] = [];
  const dentro: T[] = [];
  for (const p of persone) {
    const n = normalizza(p.nome);
    if (n.startsWith(q)) inizia.push(p);
    else if (n.includes(q)) dentro.push(p);
  }
  return [...inizia, ...dentro].slice(0, massimo);
}

function normalizza(s: string): string {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

/** Mette il nome scelto al posto del tag. Torna il testo nuovo e dove va il
 *  cursore.
 *  ⚠️ LO SPAZIO IN FONDO LO METTE LEI. Senza, il cursore resta attaccato al
 *   nome e la parola dopo si incolla — «@Marcociao» — e per giunta il tag
 *   resterebbe aperto perché manca proprio lo spazio che lo chiude. */
export function scegliPersona(
  testo: string,
  tag: Tag,
  nome: string,
): { testo: string; cursore: number } {
  const s = String(testo ?? "");
  const fine = tag.inizio + 1 + tag.cerca.length;
  //  Il nome può contenere spazi: si scrive per intero, ed è il motivo per cui
  //  i nomi con lo spazio si scelgono dall'elenco invece di digitarli.
  const pulito = String(nome ?? "").replace(/[\n\r]/g, " ").trim() || "Ospite";
  const nuovo = `${s.slice(0, tag.inizio)}@${pulito} ${s.slice(fine)}`;
  return { testo: nuovo, cursore: tag.inizio + 1 + pulito.length + 1 };
}
