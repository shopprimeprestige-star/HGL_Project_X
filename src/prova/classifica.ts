/** ── QUALI TAGLI SCEGLIE LA GENTE ──────────────────────────────────────────
 *
 *  Ogni prova andata a buon fine lascia un segno: quale taglio, quale colore,
 *  se il taglio l'ha portato la persona con una sua foto. Da qui esce la
 *  classifica che si guarda nel gestionale.
 *
 *  ── ⚠️ A COSA SERVE DAVVERO ──────────────────────────────────────────────
 *  Non è una statistica per far bella figura in una schermata. Dice tre cose
 *  che cambiano il lavoro:
 *   · QUALI TAGLI TENERE IN VETRINA. Se venti riquadri su venticinque non li
 *     tocca nessuno, quella non è scelta: è un muro da attraversare per
 *     arrivare ai quattro che interessano davvero.
 *   · COSA PROPORRE IN CONSULENZA. Chi arriva ha già in testa una forma, e da
 *     qui si sa qual è prima ancora di chiederglielo.
 *   · QUANDO LE FOTO NON BASTANO PIÙ. Se «carica una foto tua» sale sopra
 *     tutti, vuol dire che il catalogo non ha quello che la gente cerca — ed è
 *     il momento di aggiungerne, non di aspettare che qualcuno se ne lamenti.
 *
 *  ── ⚠️ NON SI SEGNA NIENTE DELLA PERSONA ─────────────────────────────────
 *  Qui dentro ci sono contatori e basta: nessuna foto, nessun numero, nessun
 *  identificativo di chi ha provato. Una classifica dei tagli non ha bisogno
 *  di sapere chi li ha scelti, e un registro che si porta dietro le persone è
 *  un registro che prima o poi finisce nel posto sbagliato.
 */

export interface Scelta {
  /** la chiave del taglio scelto, oppure vuoto se è arrivato da una foto */
  taglio?: string;
  colore?: string;
  /** il taglio l'ha portato la persona con una sua fotografia */
  daFoto?: boolean;
}

export interface Conteggi {
  /** quante volte è stato scelto ogni taglio del catalogo */
  tagli: Record<string, number>;
  colori: Record<string, number>;
  /** quante prove sono partite da una foto portata dalla persona */
  daFoto: number;
  totale: number;
  /** ISO della prima e dell'ultima prova: senza, «43 scelte» non dice se sono
   *  di ieri o di sei mesi. */
  dal?: string;
  al?: string;
}

export const VUOTO: Conteggi = { tagli: {}, colori: {}, daFoto: 0, totale: 0 };

/** ⚠️ NON MODIFICA QUELLO CHE RICEVE: restituisce un conteggio nuovo. È il
 *  motivo per cui questa funzione si può provare, e per cui due richieste che
 *  arrivano insieme non si mangiano i dati a vicenda dentro al processo. */
export function conta(prima: Conteggi | null | undefined, s: Scelta, quando: string): Conteggi {
  const c: Conteggi = {
    tagli: { ...(prima?.tagli || {}) },
    colori: { ...(prima?.colori || {}) },
    daFoto: Number(prima?.daFoto || 0),
    totale: Number(prima?.totale || 0),
    ...(prima?.dal ? { dal: prima.dal } : {}),
  };
  const t = String(s.taglio || "").trim();
  //  ⚠️ Il taglio portato in fotografia CONTA, ma in una casella sua: metterlo
  //   fra i tagli del catalogo con la chiave vuota vorrebbe dire una riga
  //   senza nome in cima alla classifica, e nessuno saprebbe cos'è.
  if (s.daFoto || !t) c.daFoto += 1;
  else c.tagli[t] = (c.tagli[t] || 0) + 1;

  const col = String(s.colore || "").trim();
  if (col) c.colori[col] = (c.colori[col] || 0) + 1;

  c.totale += 1;
  if (!c.dal) c.dal = quando;
  c.al = quando;
  return c;
}

export interface RigaClassifica {
  chiave: string;
  nome: string;
  quante: number;
  /** percentuale sul totale delle prove, arrotondata all'intero */
  quota: number;
}

/** La classifica, dal più scelto al meno.
 *  ⚠️ CI SONO ANCHE QUELLI A ZERO, ed è la metà del valore di questa pagina:
 *   sapere che un taglio non l'ha scelto MAI nessuno è un'informazione che si
 *   può usare (toglierlo, o cambiargli la fotografia), mentre una classifica
 *   dei soli primi cinque non dice niente sugli altri venti. */
export function classifica(
  c: Conteggi | null | undefined,
  catalogo: { chiave: string; nome: string }[],
): RigaClassifica[] {
  const tot = Math.max(1, Number(c?.totale || 0));
  return catalogo
    .map((t) => {
      const quante = Number(c?.tagli?.[t.chiave] || 0);
      return { chiave: t.chiave, nome: t.nome, quante, quota: Math.round((quante * 100) / tot) };
    })
    //  A parità di scelte vince l'ordine del catalogo: due righe che ballano
    //  fra loro a ogni ricarica fanno sembrare instabile un numero fermo.
    .sort((a, b) => b.quante - a.quante);
}

/** Lo stesso per i colori. Il catalogo dei colori lo passa chi chiama, così
 *  questo file non deve sapere niente di come si chiamano davanti alla gente. */
export function classificaColori(
  c: Conteggi | null | undefined,
  catalogo: { chiave: string; nome: string }[],
): RigaClassifica[] {
  const tot = Math.max(1, Number(c?.totale || 0));
  return catalogo
    .map((x) => {
      const quante = Number(c?.colori?.[x.chiave] || 0);
      return { chiave: x.chiave, nome: x.nome, quante, quota: Math.round((quante * 100) / tot) };
    })
    .sort((a, b) => b.quante - a.quante);
}
