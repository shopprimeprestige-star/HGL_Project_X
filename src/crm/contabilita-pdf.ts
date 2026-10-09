/** ── LEGGERE UNA FATTURA CHE È SOLO UN PDF ─────────────────────────────────
 *
 *  Meta, Google, Amazon, Alibaba, i fornitori americani: nessuno di loro manda
 *  un XML allo SDI, perché non sono tenuti a farlo. Mandano un PDF. Quel PDF
 *  va caricato, conservato e registrato, e finora andava registrato scrivendo
 *  a mano ogni numero — che per la fattura di Meta di ogni mese vuol dire
 *  ricopiare le stesse quattro cose dodici volte l'anno.
 *
 *  ── ⚠️ QUESTO MODULO PROPONE, NON REGISTRA ────────────────────────────────
 *  È la differenza che tiene in piedi tutto il resto. Dall'XML i numeri si
 *  LEGGONO: il tracciato è fisso e l'imponibile sta in un campo che si chiama
 *  `ImponibileImporto`. Da un PDF si RICONOSCONO: si cerca la parola «totale»
 *  e si guarda il numero lì vicino. Va bene quasi sempre e ogni tanto sbaglia,
 *  e un numero sbagliato dentro una liquidazione IVA è peggio di un numero
 *  assente.
 *  Quindi: si legge il PDF, si RIEMPIE la finestra, e chi carica vede i numeri
 *  proposti accanto al documento e conferma. Il campo compilato da qui non è
 *  diverso da uno battuto a mano — la fattura resta segnata `aMano`, perché
 *  è esattamente quello che è: un numero che una persona ha confermato.
 *
 *  ── COME SI APRE UN PDF SENZA UNA LIBRERIA ────────────────────────────────
 *  Un PDF è testo con dentro dei blocchi compressi. I blocchi stanno fra
 *  `stream` e `endstream` e quasi sempre sono zlib, che il browser sa
 *  scompattare da solo (`DecompressionStream`). Dentro, il testo sta negli
 *  operatori `Tj` e `TJ`.
 *  ⚠️ NON SEMPRE FUNZIONA, e va detto invece che far finta. Un PDF che è la
 *   FOTO di una fattura non ha nessun testo dentro: lì non c'è niente da
 *   leggere se non riconoscendo delle immagini, e quello questo programma non
 *   lo fa. Certi PDF poi usano font con una codifica loro, e il testo esce
 *   illeggibile. In tutti e due i casi si torna indietro con le mani vuote, la
 *   finestra si apre VUOTA con il file già allegato, e si scrive a mano come
 *   prima. Nessuna proposta è meglio di una proposta inventata.
 *  ───────────────────────────────────────────────────────────────────────── */

/** Il testo trovato, e quanto ci si può contare. */
export interface LetturaPdf {
  testo: string;
  /** false = dentro non c'era testo (è una scansione), o non si è saputo
   *  scompattare. La finestra si apre vuota e lo dice. */
  ok: boolean;
  motivo: string;
}

const decodifica = (b: Uint8Array): string => {
  //  latin1 e non utf-8: la struttura del PDF è fatta di byte, e utf-8
  //  sostituirebbe i byte non validi con dei punti interrogativi — spostando
  //  le posizioni e rompendo il ritrovamento dei blocchi.
  let s = "";
  const passo = 0x8000;
  for (let i = 0; i < b.length; i += passo) {
    s += String.fromCharCode(...b.subarray(i, i + passo));
  }
  return s;
};

const codifica = (s: string): Uint8Array => {
  const b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 0xff;
  return b;
};

async function scompatta(dati: Uint8Array): Promise<string> {
  if (typeof DecompressionStream === "undefined") return "";
  //  ⚠️ «deflate» e non «deflate-raw»: il FlateDecode del PDF è zlib, con la
  //   sua intestazione di due byte. Sbagliare i due nomi dà sempre errore, mai
  //   testo sbagliato — quindi si prova anche l'altro, che certi generatori
  //   scrivono davvero senza intestazione.
  for (const formato of ["deflate", "deflate-raw"] as const) {
    try {
      const flusso = new Blob([dati as BlobPart])
        .stream()
        .pipeThrough(new DecompressionStream(formato));
      const fuori = new Uint8Array(await new Response(flusso).arrayBuffer());
      if (fuori.length) return decodifica(fuori);
    } catch {
      /*  Il blocco non era compresso così: si prova l'altro modo, e se non va
          nemmeno quello si lascia perdere QUESTO blocco — non tutto il file.
          Un PDF ha dentro anche font e immagini, che non si aprono e non
          devono far fallire la lettura del testo. */
    }
  }
  return "";
}

/** ── ⚠️ LE LETTERE NON SONO LETTERE: LA TABELLA `ToUnicode` ───────────────
 *
 *  Il caso che fa fallire tutti i lettori di PDF scritti in fretta, e che si
 *  scopre solo su una fattura VERA. Un PDF stampato dal browser, o generato da
 *  un gestionale, incorpora i font RITAGLIATI: dentro ci sono solo le lettere
 *  che servono a quel documento, rinumerate da capo. Il byte che nel file vale
 *  0x26 non è «&»: è la sesta lettera di quel font, e quale sia lo dice
 *  soltanto una tabella allegata al font, la `/ToUnicode`.
 *
 *  Senza leggerla, da una fattura vera esce «&RQIHUPD RUGLQH» al posto di
 *  «Conferma ordine»: testo in quantità normale, che passa il controllo «è una
 *  scansione», fatto di lettere che non sono parole. Con la tabella, esce
 *  quello che si vede aprendo il PDF.
 *
 *  ── COM'È FATTA ───────────────────────────────────────────────────────────
 *  È un flusso compresso con dentro delle righe come:
 *    3 beginbfchar <0026> <0043> <0027> <006F> … endbfchar
 *    2 beginbfrange <0041> <005A> <0061> … endbfrange
 *  A sinistra il codice nel file, a destra il carattere vero in esadecimale.
 *  I `bfrange` dicono un intervallo intero con una sola riga.
 *
 *  ⚠️ UNA TABELLA PER FONT, e il font attivo lo dice `/F1 Tf` dentro il
 *   flusso. Mescolare le tabelle di due font — il tondo e il grassetto — vuol
 *   dire leggere metà documento con l'alfabeto sbagliato.
 *  ───────────────────────────────────────────────────────────────────────── */
export type Mappa = { da: Map<number, string>; due: boolean };
export type MappeFont = Record<string, Mappa>;

/** Il testo di una stringa PDF letto con la tabella del font. */
function conLaMappa(g: string, m: Mappa): string {
  //  I byte: da una stringa esadecimale <0026 0027> o da una fra parentesi.
  const byte: number[] = [];
  if (g.startsWith("<")) {
    const hex = g.slice(1, -1).replace(/\s+/g, "");
    for (let i = 0; i + 1 < hex.length; i += 2) byte.push(parseInt(hex.slice(i, i + 2), 16));
  } else {
    const grezzo = g
      .slice(1, -1)
      .replace(/\\([nrtbf])/g, (_x, c: string) =>
        c === "n" || c === "r" ? "\n" : c === "t" ? "\t" : "",
      )
      .replace(/\\([0-7]{1,3})/g, (_x, o: string) => String.fromCharCode(parseInt(o, 8)))
      .replace(/\\(.)/g, "$1");
    for (let i = 0; i < grezzo.length; i++) byte.push(grezzo.charCodeAt(i) & 0xff);
  }
  let fuori = "";
  const passo = m.due ? 2 : 1;
  for (let i = 0; i < byte.length; i += passo) {
    const codice = m.due ? (byte[i] << 8) | (byte[i + 1] ?? 0) : byte[i];
    //  ⚠️ Un codice che la tabella non conosce NON diventa il suo byte: su un
    //   font ritagliato quel byte è un'altra lettera, e scriverla sarebbe
    //   inventare. Si mette uno spazio, che non somiglia a una parola.
    fuori += m.da.get(codice) ?? " ";
  }
  return fuori;
}

/** Legge una tabella `ToUnicode` già scompattata. */
export function leggiCMap(testo: string): Mappa {
  const da = new Map<number, string>();
  /*  ── ⚠️ QUANTI BYTE VALE UN CODICE LO DICE `codespacerange` ───────────
      `<00> <FF>` = un byte per carattere; `<0000> <FFFF>` = due. È il campo
      fatto apposta, e sta in testa a ogni tabella vera.
      Prima lo deducevo dalla lunghezza dei codici scritti nei `bfchar`, che è
      un indizio e non una regola: una tabella che scrive `<0041>` per il
      codice 0x41 di un font a un byte — e ce ne sono — faceva leggere i byte
      a due a due. Il risultato non era testo sbagliato: era NIENTE, perché
      nessun codice combaciava più e ogni carattere diventava uno spazio. */
  const spazio = testo.match(/begincodespacerange\s*<([0-9A-Fa-f]+)>/);
  let due = spazio ? spazio[1].length > 2 : false;
  const larghezzaDichiarata = !!spazio;
  const car = (hex: string): string => {
    //  Il lato destro può contenere più caratteri (una legatura «fi»).
    let s = "";
    for (let i = 0; i + 3 < hex.length + 1; i += 4) {
      const c = parseInt(hex.slice(i, i + 4), 16);
      if (Number.isFinite(c) && c > 0) s += String.fromCharCode(c);
    }
    return s;
  };
  for (const blocco of testo.split(/beginbfchar/).slice(1)) {
    const dentro = blocco.split(/endbfchar/)[0] ?? "";
    for (const m of dentro.matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) {
      if (!larghezzaDichiarata && m[1].length > 2) due = true;
      da.set(parseInt(m[1], 16), car(m[2]));
    }
  }
  for (const blocco of testo.split(/beginbfrange/).slice(1)) {
    const dentro = blocco.split(/endbfrange/)[0] ?? "";
    //  Due forme: <lo> <hi> <primo>, e <lo> <hi> [<a> <b> <c>].
    for (const m of dentro.matchAll(
      /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*(?:<([0-9A-Fa-f]+)>|\[([^\]]*)\])/g,
    )) {
      if (!larghezzaDichiarata && m[1].length > 2) due = true;
      const lo = parseInt(m[1], 16);
      const hi = parseInt(m[2], 16);
      //  ⚠️ Con un tetto: un intervallo storto — o letto male — potrebbe
      //   dichiarare un milione di codici e fermare la pagina.
      if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi < lo || hi - lo > 65_535) continue;
      if (m[3]) {
        const base = parseInt(m[3], 16);
        for (let c = lo; c <= hi; c++) da.set(c, String.fromCharCode(base + (c - lo)));
      } else if (m[4]) {
        let c = lo;
        for (const x of m[4].matchAll(/<([0-9A-Fa-f]+)>/g)) {
          if (c > hi) break;
          da.set(c++, car(x[1]));
        }
      }
    }
  }
  return { da, due };
}

/** ── I PEZZI DI TESTO DENTRO UN FLUSSO DI CONTENUTO ──────────────────────
 *
 *  ── ⚠️ DUE COSE CHE SEMBRANO DETTAGLI E INVECE DECIDONO TUTTO ─────────────
 *  Questa funzione è stata scritta due volte. La prima versione funzionava sui
 *  PDF che ci si costruisce per provare — testo semplice, `(riga) Tj`, un `Td`
 *  a ogni capo — e su NESSUNA fattura vera. I generatori veri (le stampanti
 *  PDF, i gestionali, Meta, Amazon) scrivono in un altro modo:
 *
 *   1. POSIZIONANO CON `Tm`, non con `Td`. `Tm` mette la matrice del testo, e
 *      il suo ultimo numero è la Y. Chi guarda solo `Td` non vede nessun capo
 *      riga, e l'intera fattura esce come UNA riga di quattrocento parole.
 *
 *   2. SCRIVONO IN ARRAY `TJ` CON LA CRENATURA IN MEZZO ALLE PAROLE:
 *      `[(M) -12 (eta Platf) 5 (orms)] TJ`. I numeri in mezzo sono
 *      spostamenti in millesimi di em, servono a stringere le lettere.
 *      Unendo i pezzi con uno spazio — che è quello che facevo — «Meta
 *      Platforms Ireland» diventa «Meta Pl atforms Ir ela nd»: nessuna parola
 *      è più cercabile, e il riconoscimento non trova niente. Vanno attaccati.
 *      Uno spazio ci va SOLO se lo spostamento è grande e negativo (sotto i
 *      -120 millesimi ≈ la larghezza di uno spazio): è il modo in cui certi
 *      generatori scrivono gli spazi senza usare il carattere spazio.
 *
 *  Il risultato deve somigliare a quello che si vede aprendo il PDF: è l'unica
 *  forma su cui abbia senso cercare una data, un totale o una ragione sociale.
 *  ───────────────────────────────────────────────────────────────────────── */
function testoDalFlusso(flusso: string, font: MappeFont = {}): string {
  const righe: string[] = [];
  /** Il font in uso: cambia con `/F1 Tf` e decide come si leggono i byte. */
  let mappa: Mappa | null = null;

  const dentroLaStringa = (g: string): string => {
    //  ── ⚠️ CON LA TABELLA DEL FONT, QUANDO C'È ─────────────────────────
    //   Vedi `mappeDeiFont`: senza, da un PDF stampato dal browser esce
    //   «&RQIHUPD» al posto di «Conferma».
    if (mappa) return conLaMappa(g, mappa);
    if (g.startsWith("<")) {
      //  Esadecimale: due cifre per byte. Le codifiche a due byte dei font
      //  incorporati danno spesso spazzatura, e il controllo sulle parole in
      //  `leggiPdf` se ne accorge.
      const hex = g.slice(1, -1).replace(/\s+/g, "");
      let s = "";
      for (let i = 0; i + 1 < hex.length; i += 2) {
        const c = parseInt(hex.slice(i, i + 2), 16);
        if (c >= 32 || c === 10) s += String.fromCharCode(c);
      }
      return s;
    }
    return g
      .slice(1, -1)
      .replace(/\\([nrtbf])/g, (_x, c: string) =>
        c === "n" || c === "r" ? "\n" : c === "t" ? " " : "",
      )
      .replace(/\\([0-7]{1,3})/g, (_x, o: string) => String.fromCharCode(parseInt(o, 8)))
      .replace(/\\(.)/g, "$1");
  };

  /** Lo spostamento sotto il quale i generatori intendono uno spazio. In
   *  millesimi di em: uno spazio sta fra i 250 e i 350, la crenatura fra le
   *  lettere sotto i 50. Centoventi sta comodamente in mezzo. */
  const SPAZIO = -120;

  const dentroLArray = (corpo: string): string => {
    let s = "";
    const re = /(\((?:\\.|[^\\()])*\)|<[0-9A-Fa-f\s]+>)|(-?[\d.]+)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(corpo))) {
      if (m[1]) s += dentroLaStringa(m[1]);
      else if (Number(m[2]) <= SPAZIO) s += " ";
    }
    return s;
  };

  for (const blocco of flusso.split(/\bBT\b/).slice(1)) {
    const dentro = blocco.split(/\bET\b/)[0] ?? "";
    let riga = "";
    let y: number | null = null;
    const chiudi = () => {
      const r = riga.replace(/[ \t]{2,}/g, " ").trim();
      if (r) righe.push(r);
      riga = "";
    };
    /*  Un'espressione sola per tutto quello che conta, perché conta l'ORDINE
        in cui le cose compaiono: il testo da mostrare e gli spostamenti che
        dicono dove finisce una riga e ne comincia un'altra. */
    const re =
      /\[([^\]]*)\]\s*TJ|(\((?:\\.|[^\\()])*\)|<[0-9A-Fa-f\s]+>)\s*(?:TJ|Tj|'|")|(-?[\d.]+)\s+(-?[\d.]+)\s+T[dD]\b|(?:-?[\d.]+\s+){4}(-?[\d.]+)\s+(-?[\d.]+)\s+Tm\b|\bT\*|\/([A-Za-z0-9]+)\s+[\d.]+\s+Tf\b/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(dentro))) {
      if (m[1] != null) {
        riga += dentroLArray(m[1]);
      } else if (m[2]) {
        riga += dentroLaStringa(m[2]);
      } else if (m[4] != null) {
        //  `tx ty Td`: uno spostamento verticale è un capo riga.
        if (Math.abs(Number(m[4])) > 0.5) chiudi();
      } else if (m[6] != null) {
        //  `a b c d e f Tm`: `f` è la Y assoluta. Cambiata = riga nuova;
        //  uguale = si sta solo tornando indietro sulla stessa riga, cosa che
        //  i generatori fanno per cambiare grassetto a metà frase.
        const nuova = Number(m[6]);
        if (y !== null && Math.abs(nuova - y) > 0.5) chiudi();
        y = nuova;
      } else if (m[7]) {
        //  `/F1 11 Tf`: da qui in poi i byte si leggono con la tabella di
        //  QUEL font. Sbagliare font vuol dire leggere lettere a caso.
        mappa = font[m[7]] ?? null;
      } else {
        //  `T*`: vai a capo, e basta.
        chiudi();
      }
    }
    chiudi();
  }
  return righe.join("\n");
}

/** Il corpo grezzo del flusso che comincia a `apre`, con la misura presa dal
 *  dizionario quando c'è. Un posto solo, perché la sbaglia chi la scrive due
 *  volte — e sbagliarla qui vuol dire non leggere niente. */
function corpoDelFlusso(grezzo: string, apre: number, chiude: number, dizionario: string): string {
  let inizio = apre + "stream".length;
  if (grezzo[inizio] === "\r") inizio++;
  if (grezzo[inizio] === "\n") inizio++;
  const dichiarata = dizionario.match(/\/Length\s+(\d+)\s*(?:\/|>>)/);
  const quanto = dichiarata ? Number(dichiarata[1]) : 0;
  return quanto > 0 && inizio + quanto <= chiude
    ? grezzo.slice(inizio, inizio + quanto)
    : grezzo.slice(inizio, chiude).replace(/\r?\n$/, "");
}

/** Il flusso dell'oggetto numero `n`, scompattato. */
async function flussoDiOggetto(grezzo: string, n: number): Promise<string> {
  const re = new RegExp(`(?:^|[^0-9])${n}\\s+0\\s+obj`, "g");
  const m = re.exec(grezzo);
  if (!m) return "";
  const inizioOggetto = m.index;
  const apre = grezzo.indexOf("stream", inizioOggetto);
  if (apre < 0) return "";
  const chiude = grezzo.indexOf("endstream", apre);
  if (chiude < 0) return "";
  const dizionario = grezzo.slice(inizioOggetto, apre);
  const corpo = corpoDelFlusso(grezzo, apre, chiude, dizionario);
  if (!/FlateDecode/.test(dizionario)) return corpo;
  return scompatta(codifica(corpo));
}

/** ── ⚠️ GLI OGGETTI NASCOSTI DENTRO UN FLUSSO ────────────────────────────
 *  Dal PDF 1.5 i generatori possono impacchettare i dizionari degli oggetti
 *  dentro un flusso compresso (`/Type /ObjStm`) invece di lasciarli in chiaro
 *  nel file. Lo fanno Word, LibreOffice, parecchie librerie Java: il file
 *  pesa meno, e per chi lo legge cercando `12 0 obj` non esiste niente.
 *
 *  Se il dizionario del font sta lì dentro, la catena
 *  `/F1 → oggetto font → /ToUnicode` si spezza al primo passo: nessuna
 *  tabella, testo illeggibile, e il documento viene rifiutato con la frase
 *  «usa dei caratteri suoi» — che è onesta ma inutile, perché la tabella c'è,
 *  è solo dentro una scatola che non si era aperta.
 *
 *  Qui le scatole si aprono e il contenuto si riscrive nella forma normale
 *  `N 0 obj … endobj`, così il resto del programma non deve sapere niente di
 *  tutto questo. Dentro un ObjStm ci sono: `/N` oggetti, le loro coppie
 *  «numero posizione» in testa, e da `/First` in poi i dizionari attaccati.
 *  ⚠️ Le TABELLE non ci stanno mai, dentro: sono flussi a loro volta, e un
 *   flusso non può stare dentro un ObjStm. Restano dove `flussoDiOggetto` le
 *   sa già trovare. */
async function oggettiNascosti(grezzo: string): Promise<string> {
  const fuori: string[] = [];
  let i = 0;
  for (;;) {
    const apre = grezzo.indexOf("stream", i);
    if (apre < 0) break;
    const chiude = grezzo.indexOf("endstream", apre);
    if (chiude < 0) break;
    const dizionario = grezzo.slice(Math.max(0, apre - 400), apre);
    i = chiude + "endstream".length;
    if (!/\/ObjStm/.test(dizionario)) continue;
    const corpo = corpoDelFlusso(grezzo, apre, chiude, dizionario);
    const dentro = /FlateDecode/.test(dizionario)
      ? await scompatta(codifica(corpo)).catch(() => "")
      : corpo;
    if (!dentro) continue;
    const quanti = Number(dizionario.match(/\/N\s+(\d+)/)?.[1] ?? 0);
    const primo = Number(dizionario.match(/\/First\s+(\d+)/)?.[1] ?? 0);
    if (!quanti || !primo) continue;
    //  In testa: `num pos num pos …`, tante coppie quanti sono gli oggetti.
    const coppie = [...dentro.slice(0, primo).matchAll(/(\d+)\s+(\d+)/g)].slice(0, quanti);
    for (let k = 0; k < coppie.length; k++) {
      const numero = coppie[k][1];
      const da = primo + Number(coppie[k][2]);
      const a = k + 1 < coppie.length ? primo + Number(coppie[k + 1][2]) : dentro.length;
      if (da >= a || a > dentro.length) continue;
      fuori.push(`${numero} 0 obj ${dentro.slice(da, a)} endobj`);
    }
  }
  return fuori.join("\n");
}

/** ── LE TABELLE DEI FONT DEL DOCUMENTO ────────────────────────────────────
 *  `/F1` → la tabella con cui leggere i suoi byte. Si arriva in tre passi:
 *  le Risorse dicono `/F1 12 0 R`, l'oggetto 12 dice `/ToUnicode 13 0 R`, e
 *  l'oggetto 13 è la tabella. Chi non fa i tre passi legge lettere a caso. */
async function mappeDeiFont(grezzoSolo: string): Promise<MappeFont> {
  //  ⚠️ Anche quello che sta dentro gli ObjStm: senza, su un PDF fatto da Word
  //   la catena verso la tabella del font si spezza al primo passo.
  const nascosti = await oggettiNascosti(grezzoSolo).catch(() => "");
  const grezzo = nascosti ? `${grezzoSolo}\n${nascosti}` : grezzoSolo;
  const nomeAOggetto: Record<string, number> = {};
  for (const m of grezzo.matchAll(/\/Font\s*<<([\s\S]{0,4000}?)>>/g)) {
    for (const f of m[1].matchAll(/\/([A-Za-z0-9]+)\s+(\d+)\s+0\s+R/g)) {
      nomeAOggetto[f[1]] = Number(f[2]);
    }
  }
  const fontACmap: Record<number, number> = {};
  for (const m of grezzo.matchAll(/(\d+)\s+0\s+obj\s*<<([\s\S]{0,3000}?)>>/g)) {
    const tu = m[2].match(/\/ToUnicode\s+(\d+)\s+0\s+R/);
    if (tu) fontACmap[Number(m[1])] = Number(tu[1]);
  }
  const fuori: MappeFont = {};
  //  Le tabelle si leggono una volta sola anche se due font la condividono.
  const lette = new Map<number, Mappa>();
  for (const [nome, oggetto] of Object.entries(nomeAOggetto)) {
    const cmap = fontACmap[oggetto];
    if (!cmap) continue;
    let m = lette.get(cmap);
    if (!m) {
      //  ⚠️ La tabella si cerca nel file VERO, non nel testo ricostruito: è un
      //   flusso, e i flussi stanno sempre in chiaro.
      const testo = await flussoDiOggetto(grezzoSolo, cmap).catch(() => "");
      if (!testo) continue;
      m = leggiCMap(testo);
      lette.set(cmap, m);
    }
    if (m.da.size > 0) fuori[nome] = m;
  }
  return fuori;
}

export async function leggiPdf(dati: ArrayBuffer): Promise<LetturaPdf> {
  const grezzo = decodifica(new Uint8Array(dati));
  if (!grezzo.startsWith("%PDF")) {
    return { ok: false, testo: "", motivo: "questo file non è un PDF" };
  }
  /*  ⚠️ UN PDF CIFRATO NON È UNA SCANSIONE, e dirgli la frase sbagliata manda
      a cercare uno scanner per un file che basterebbe riesportare. I flussi di
      un PDF protetto non si scompattano — nemmeno quando la password è vuota,
      perché la protezione può essere solo «non stampare» — e senza dirlo si
      finirebbe a chiamarlo «foto di una fattura». */
  if (/\/Encrypt\s+\d+\s+0\s+R|\/Encrypt\s*<</.test(grezzo)) {
    return {
      ok: false,
      testo: "",
      motivo:
        "questo PDF è protetto: i suoi contenuti sono cifrati e non si possono leggere. Riesportalo senza protezione dal programma che l'ha fatto, oppure scrivi i numeri a mano — il file resta allegato lo stesso.",
    };
  }
  //  ⚠️ PRIMA LE TABELLE DEI FONT, POI IL TESTO: senza, da un PDF stampato
  //   dal browser si legge «&RQIHUPD» al posto di «Conferma». Vedi `leggiCMap`.
  const font = await mappeDeiFont(grezzo).catch(() => ({}) as MappeFont);
  const pezzi: string[] = [];
  //  I blocchi: `... stream\n<byte>\nendstream`. Si scorre a mano invece che
  //  con una sola espressione regolare perché i dati binari contengono di
  //  tutto, capi riga compresi, e una regex «tutto fino a endstream» su un
  //  file da qualche megabyte è lentissima.
  let i = 0;
  for (;;) {
    const apre = grezzo.indexOf("stream", i);
    if (apre < 0) break;
    const chiude = grezzo.indexOf("endstream", apre);
    if (chiude < 0) break;
    //  Il dizionario che precede dice come è compresso.
    const dizionario = grezzo.slice(Math.max(0, apre - 400), apre);
    const corpo = corpoDelFlusso(grezzo, apre, chiude, dizionario);
    /*  ── ⚠️ SI SALTA OLTRE TUTTO «endstream», NON UN CARATTERE ───────────
        Qui c'era `chiude + 1`, ed è l'errore che ha reso questo lettore
        inutile su ogni fattura vera senza che nessuna prova se ne accorgesse.
        La parola «endstream» CONTIENE «stream»: ripartendo un carattere dopo,
        la ricerca successiva trovava quella, e il «corpo» del flusso seguente
        cominciava da `endobj…` — cioè dal testo del file invece che dai dati
        compressi. Da lì in poi ogni flusso era sfasato di uno e nessuno si
        apriva più.
        Su un PDF con UN flusso solo — quelli che ci si costruisce per provare
        — non si vedeva niente: il primo era giusto, e dopo non c'era altro da
        leggere. Su una fattura vera, con trecento flussi, non si leggeva una
        parola. */
    i = chiude + "endstream".length;
    //  Immagini e font compressi si saltano PRIMA di aprirli: in una fattura
    //  con il logo ci sono decine di megabyte di roba che non è testo, e
    //  scompattarli per poi non trovarci niente costa solo attesa.
    if (/\/(Image|DCTDecode|JPXDecode|FontFile|Length1)/.test(dizionario)) {
      continue;
    }
    //  ⚠️ Solo FlateDecode. LZW, RunLength e le altre compressioni antiche
    //   esistono ma non le usa più nessun generatore di fatture: dichiararle
    //   supportate e leggerle male sarebbe peggio che saltarle.
    if (/FlateDecode/.test(dizionario)) {
      const fuori = await scompatta(codifica(corpo));
      if (fuori) pezzi.push(testoDalFlusso(fuori, font));
    } else {
      pezzi.push(testoDalFlusso(corpo, font));
    }
  }
  const testo = pezzi
    .join("\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  //  ⚠️ Poche lettere = non c'era testo. Il numero è basso di proposito: serve
  //   a distinguere «una scansione» da «una fattura», non a giudicare la
  //   qualità di quello che si è letto.
  if (testo.replace(/[^A-Za-z]/g, "").length < 20) {
    return {
      ok: false,
      testo,
      motivo:
        "dentro questo PDF non c'è testo da leggere: è la scansione o la foto di una fattura. Il file resta allegato, i numeri si scrivono a mano.",
    };
  }
  /*  ── ⚠️ TESTO TANTO, MA È SPAZZATURA ──────────────────────────────────
      Il controllo qui sopra riconosce la SCANSIONE — un PDF che di testo non
      ne ha proprio. Ce n'è un secondo caso, più insidioso: i PDF con dentro
      dei font ritagliati e una codifica loro, da cui esce una quantità
      normale di lettere che però non sono parole. Lì il primo controllo passa,
      e il riconoscimento va avanti a proporre numeri pescati da caratteri a
      caso — cioè l'unica cosa peggiore di non proporre niente.
      Una fattura, in qualunque lingua sia, contiene almeno una di queste
      parole. Nessuna: non si è capito, e lo si dice. */
  if (
    !/(fattura|invoice|rechnung|facture|factura|totale|total|imponibile|amount|importo|iva|vat|tax|data|date|datum|fecha)/i.test(
      testo,
    )
  ) {
    return {
      ok: false,
      testo,
      motivo:
        "il testo dentro questo PDF non si è capito: usa dei caratteri suoi, e quello che ne esce non sono parole. Il file resta allegato, i numeri si scrivono a mano.",
    };
  }
  return { ok: true, testo, motivo: "" };
}

/* ═══════════════════════════════════════════════════════════════════════════
   DAL TESTO ALLA PROPOSTA
   ═════════════════════════════════════════════════════════════════════════ */

import { zonaDelPaese, type RegimeIva } from "./contabilita-regimi";

export interface Proposta {
  fornitore?: string;
  /** Il documento RIDÀ dei soldi invece di chiederne: un rimborso, un
   *  accredito, l'annullamento di una fattura di prima. */
  notaDiCredito?: boolean;
  /** ── LA VALUTA RICONOSCIUTA, EURO COMPRESO ────────────────────────────
   *  `valuta` qui sopra si riempie solo quando NON è euro, perché è il campo
   *  da compilare. Questo invece dice sempre cosa si è visto, e serve a una
   *  cosa sola: poter scrivere «il documento è in euro» invece di lasciare
   *  due campi vuoti con dentro «USD» e «0,00» in grigio, che si leggono come
   *  campi da riempire. Un campo che deve restare vuoto è meglio non
   *  mostrarlo. */
  valutaVista?: string;
  /** L'aliquota con cui autoliquidare, quando il documento la dice. */
  aliquota?: number;
  /** Cosa è stato comprato, come lo scrive il documento. */
  descrizione?: string;
  partitaIva?: string;
  paese?: string;
  data?: string;
  numero?: string;
  imponibile?: number;
  imposta?: number;
  valuta?: string;
  importoValuta?: number;
  regime?: RegimeIva;
  /** ── ⚠️ QUESTA FATTURA L'HAI EMESSA TU ─────────────────────────────────
   *  Il caso che si verifica davvero, ed è quello che fa più danno: si scarica
   *  dal CRM la propria fattura per guardarla, e poi la si ricarica nella
   *  schermata dei fornitori. Nessun errore, nessun avviso: un ricavo di
   *  2.350 € entrerebbe in contabilità come un COSTO di 2.350 €, e l'IVA a
   *  debito diventerebbe IVA a credito. È un errore da quattro cifre che
   *  nessuna somma tornerebbe a smentire. */
  emessaDaNoi?: boolean;
  /** ── ⚠️ È UNA PROFORMA, CIOÈ NON È UNA FATTURA ─────────────────────────
   *  I fornitori esteri — quelli cinesi quasi sempre — mandano prima una
   *  «proforma invoice»: serve a farsi pagare, ed è un preventivo con l'aria
   *  di una fattura. In Italia NON è un documento fiscale: non si registra,
   *  non fa detrarre niente, non fa nascere nessun obbligo.
   *
   *  ⚠️ E IL DANNO NON È NON REGISTRARLA: è registrarla. Una proforma messa
   *   nei registri IVA è un documento che non esiste dentro numeri che devono
   *   quadrare con quelli dell'Agenzia — e quando la fattura definitiva arriva
   *   davvero, lo stesso acquisto ci finisce due volte.
   *  Qui si riconosce e basta: il costo si segue lo stesso (serve saperlo, i
   *  soldi sono usciti), ma la riga resta fuori dai registri finché non arriva
   *  il documento vero. Chi carica lo vede scritto prima di confermare. */
  proforma?: boolean;
  /** Cosa è stato riconosciuto e cosa no, in parole: si mostra sopra i campi
   *  perché chi conferma sappia quanto deve controllare. */
  spiega: string[];
}

/** ── LE PAROLE CON CUI UN DOCUMENTO DICE DI NON ESSERE UNA FATTURA ────────
 *  In inglese, in italiano e nelle due forme che usano i fornitori asiatici.
 *  ⚠️ «Pro forma» con lo spazio esiste e si vede spesso; «PI» da solo NO —
 *   sono due lettere che compaiono ovunque, e basterebbero a far dichiarare
 *   proforma una fattura vera. */
const DICE_PROFORMA =
  /\b(pro\s?-?\s?forma\s+invoice|proforma\s+invoice|fattura\s+proforma|proforma|pro\s+forma|quotation\s+invoice|sales\s+contract)\b/i;

/** Vero se il documento dichiara di essere una proforma. */
export const eProforma = (testo: string): boolean => DICE_PROFORMA.test(String(testo ?? ""));

/** ── I FORNITORI CHE TORNANO OGNI MESE ────────────────────────────────────
 *  Non è un elenco di comodo: sono le fatture che arrivano sempre uguali, e
 *  per le quali il regime è una cosa CONOSCIUTA e non da indovinare. Meta
 *  Ireland fattura servizi pubblicitari a una partita IVA italiana senza IVA,
 *  articolo 7-ter: è così tutti i mesi.
 *  ⚠️ RESTA UNA PROPOSTA. La società che fattura può cambiare — Meta lo ha già
 *   fatto una volta, spostando la fatturazione europea — e il regime proposto
 *   si vede scritto nella finestra, spuntato, dove chi carica lo può cambiare. */
const NOTI: {
  chi: RegExp;
  nome: string;
  paese: string;
  piva?: string;
  /** Assente di proposito su chi vende sia merce sia servizi: lì il regime lo
   *  decide il CONTENUTO della fattura, non il nome in cima. */
  regime?: RegimeIva;
  /** ── ⚠️ CERCA SOLO NELL'INTESTAZIONE ────────────────────────────────────
   *  Vero per i nomi che compaiono anche come RIGA sulla fattura di qualcun
   *  altro. È costato una prova rossa: la proforma del fornitore cinese ha
   *  dentro «Fedex Handle Fee», e la regola dei corrieri se l'è presa —
   *  trasformando un'importazione dalla Cina in una fattura di corriere, con
   *  il regime che spariva e l'IVA che sarebbe stata trattata al contrario.
   *  Chi EMETTE una fattura sta scritto in cima, sempre. Chi ci compare in
   *  mezzo è quasi sempre un servizio comprato da qualcun altro. */
  soloInTesta?: boolean;
  perche: string;
}[] = [
  {
    chi: /meta platforms ireland|facebook ireland/i,
    nome: "Meta Platforms Ireland Limited",
    paese: "IE",
    piva: "IE9692928F",
    regime: "ue_servizi",
    perche: "Meta Ireland: servizi pubblicitari da un fornitore UE, si autoliquida (TD17).",
  },
  {
    /*  ── ⚠️ TIKTOK FATTURA DAL REGNO UNITO, NON DALL'IRLANDA ────────────
        È la differenza che conta: dopo la Brexit il Regno Unito è FUORI
        dall'Unione, quindi la pubblicità di TikTok non è un acquisto
        intracomunitario come Meta e Google — è un servizio EXTRA-UE.
        Cambia il documento da trasmettere (TD17 resta, ma non c'è nessun
        elenco INTRASTAT da compilare) e cambia il modo in cui il
        commercialista lo classifica. Metterlo insieme agli irlandesi sarebbe
        stato comodo e sbagliato.
        ⚠️ SE UN GIORNO FATTURASSE DA DUBLINO va cambiato qui: la ragione per
         cui il regime è scritto accanto al nome, e non indovinato, è
         esattamente questa — Meta la fatturazione europea l'ha già spostata
         una volta. */
    chi: /tiktok|bytedance/i,
    nome: "TikTok Information Technologies UK Limited",
    paese: "GB",
    regime: "estero_servizi",
    perche:
      "TikTok fattura dal Regno Unito: dopo la Brexit è fuori dall'Unione, quindi è un servizio extra-UE. Si autoliquida (TD17), ma NON va nell'elenco INTRASTAT.",
  },
  {
    /*  ── I CORRIERI: SI RICONOSCE IL NOME, NON IL REGIME ─────────────────
        ⚠️ Di proposito senza `regime`, come Amazon: sulla stessa fattura un
         corriere mette trasporti nazionali con IVA, trasporti internazionali
         non imponibili (art. 9), e le ANTICIPAZIONI dell'IVA doganale pagata
         per conto tuo — che sono fuori campo (art. 15) e non si detraggono da
         lì. Proporre un regime solo vorrebbe dire indovinare quale delle tre
         pesa di più, e sbagliare in silenzio su una fattura che ne contiene
         tre. Il nome si riempie, il regime lo sceglie chi ha il documento. */
    chi: /\b(fedex|dhl|ups\b|united parcel|gls\b|brt\b|bartolini|sda\b|tnt\b|poste italiane|nexive)\b/i,
    soloInTesta: true,
    nome: "",
    paese: "",
    perche:
      "Corriere: guarda bene le righe. Il trasporto internazionale è non imponibile (art. 9) e l'IVA doganale che ti hanno anticipato è fuori campo (art. 15) — quella si detrae dalla bolletta, non da qui.",
  },
  {
    chi: /google ireland/i,
    nome: "Google Ireland Limited",
    paese: "IE",
    piva: "IE6388047V",
    regime: "ue_servizi",
    perche: "Google Ireland: servizi da un fornitore UE, si autoliquida (TD17).",
  },
  {
    chi: /linkedin ireland|microsoft ireland|stripe payments europe|shopify international/i,
    nome: "",
    paese: "IE",
    regime: "ue_servizi",
    perche: "Fornitore irlandese di servizi: si autoliquida (TD17).",
  },
  {
    //  ⚠️ NESSUN REGIME PROPOSTO, ed è la voce che lo insegna: dalla stessa
    //   società lussemburghese arrivano una sedia da ufficio (merce, TD18) e
    //   un abbonamento (servizi, TD17). Proporne uno vorrebbe dire indovinare
    //   sul nome invece che leggere cosa c'è scritto sotto.
    chi: /amazon (eu|services europe|europe core)|amazon media eu/i,
    nome: "",
    paese: "LU",
    perche:
      "Amazon con società lussemburghese: il regime dipende da cosa hai comprato, merce (TD18) o servizio (TD17). Controlla la riga scelta qui sotto.",
  },
  {
    chi: /amazon web services|aws emea/i,
    nome: "",
    paese: "LU",
    regime: "ue_servizi",
    perche: "AWS fattura dal Lussemburgo: servizi UE, si autoliquida (TD17).",
  },
  {
    chi: /alibaba|aliexpress|shenzhen|guangzhou|\bchina\b|qingdao|ningbo|yiwu/i,
    nome: "",
    paese: "CN",
    regime: "importazione",
    perche:
      "Fornitore cinese: se è MERCE che passa la dogana l'IVA si paga lì e si detrae con il documento doganale, non con questa fattura. Se invece è un SERVIZIO, cambia in «Servizi da fuori dall'Unione».",
  },
  {
    chi: /anthropic|openai|\bstripe inc\b|cloudflare, inc|github, inc|amazon web services, inc/i,
    nome: "",
    paese: "US",
    regime: "estero_servizi",
    perche: "Fornitore statunitense di servizi: autofattura TD17, nessun INTRASTAT.",
  },
];

const num = (s: string): number => {
  //  Un importo può arrivare come 1.234,56 (europeo) o 1,234.56 (anglosassone).
  //  Decide l'ULTIMO separatore: quello che sta davanti ai due decimali.
  const t = s.replace(/[^\d.,-]/g, "");
  const virgola = t.lastIndexOf(",");
  const punto = t.lastIndexOf(".");
  const dec = Math.max(virgola, punto);
  if (dec < 0) return Number(t) || 0;
  const intero = t.slice(0, dec).replace(/[.,]/g, "");
  const resto = t.slice(dec + 1).replace(/\D/g, "");
  //  ⚠️ Più di due cifre dopo l'ultimo separatore vuol dire che quello NON era
  //   il decimale ma il separatore delle migliaia: 1.234 sono milleduecento-
  //   trentaquattro, non uno virgola due. È lo sbaglio che trasformerebbe una
  //   fattura da 1.500 € in una da 1,50 €.
  if (resto.length !== 2) return Number(t.replace(/[.,]/g, "")) || 0;
  return Number(`${intero}.${resto}`) || 0;
};

/** ── ⚠️ LE PAROLE CHE ASSOMIGLIANO A UN IMPORTO E NON LO SONO ────────────
 *  «P. IVA 09876543210» comincia con la stessa parola con cui comincia
 *  «IVA 176,00», e cercando l'imposta ci si trova dentro la partita IVA del
 *  fornitore: un numero da dieci cifre che entrava in contabilità come
 *  imposta. Non dava nessun errore — era solo una fattura da nove miliardi. */
const VIETATO = /(p\.?\s*iva|partita\s*iva|vat\s*(reg|no|number|id)|codice\s*fiscale|reg\.?\s*no)/i;

/** Il primo importo utile dopo ognuna di queste parole.
 *  ⚠️ FRA I CANDIDATI VINCONO QUELLI CON I DECIMALI. In «IVA 22% 176,00» ci
 *   sono due numeri: l'aliquota e l'imposta. Il segno di percentuale scarta il
 *   primo, ma non basta — su una fattura scritta «IVA 22 176,00» il segno non
 *   c'è. Un importo di denaro finisce quasi sempre con due decimali, e
 *   un'aliquota quasi mai: preferire i decimali sceglie l'imposta senza dover
 *   capire il resto della riga.
 *  ⚠️ E FRA PARI, IL PIÙ GRANDE: la parola «totale» compare anche nelle righe
 *   («totale riga»), e il totale del documento è il maggiore. */
function importoDopo(testo: string, parole: string): number {
  const chiave = new RegExp(`(?:${parole})`, "gi");
  const candidati: { v: number; dec: boolean }[] = [];
  let m: RegExpExecArray | null;
  while ((m = chiave.exec(testo))) {
    const intorno = testo.slice(Math.max(0, m.index - 24), m.index + m[0].length + 12);
    if (VIETATO.test(intorno)) continue;
    /*  ⚠️ LA RIGA DELL'ETICHETTA, E SE È VUOTA QUELLA DOPO. Metà delle
        fatture scrivono «Totale» a sinistra e la cifra a destra, sulla stessa
        riga; l'altra metà — comprese quelle stampate da questo CRM — mettono
        l'etichetta sopra e la cifra sotto, incolonnate. Fermarsi alla prima
        riga fa perdere la seconda metà; guardare sempre due righe fa prendere,
        sulla prima metà, il numero della voce SUCCESSIVA. Quindi: la riga, e
        la successiva solo se sulla riga non c'era nessun numero. */
    const righe = testo.slice(m.index + m[0].length).split("\n");
    const coda = (
      /\d/.test(righe[0] ?? "") ? (righe[0] ?? "") : `${righe[0] ?? ""} ${righe[1] ?? ""}`
    ).slice(0, 60);
    for (const x of coda.matchAll(/(-?\d[\d.,]*)\s*(%?)/g)) {
      //  «22%» è un'aliquota, non un importo.
      if (x[2] === "%") continue;
      /*  ⚠️ «IVA: inversione contabile art. 17 comma 6» — cercando l'imposta
          dopo la parola «IVA» si trovava il 17 dell'ARTICOLO, e una fattura in
          reverse charge da 3.400 € entrava con 17 € di imposta. Un numero
          preceduto da «art.», «comma», «n.» o «DPR» è un riferimento a una
          norma, non una somma di denaro. */
      const prima = coda.slice(Math.max(0, (x.index ?? 0) - 16), x.index ?? 0);
      if (
        /(art\.?|articolo|comma|c\.|dpr|d\.?lgs?\.?|legge|n\.|nr\.?|rif\.?|ref\.?)\s*$/i.test(prima)
      )
        continue;
      const grezzo = x[1];
      const cifre = grezzo.replace(/[.,]/g, "");
      const dec = /[.,]\d{2}$/.test(grezzo);
      //  Nove cifre attaccate senza decimali non sono una somma di denaro: è
      //  una partita IVA, un codice cliente, un numero d'ordine.
      if (cifre.length >= 9 && !dec) continue;
      candidati.push({ v: num(grezzo), dec });
      break;
    }
  }
  const conDecimali = candidati.filter((c) => c.dec);
  return (conDecimali.length ? conDecimali : candidati).reduce((max, c) => Math.max(max, c.v), 0);
}

/** ── ⚠️ SERVIZIO O MERCE? ─────────────────────────────────────────────────
 *  È la seconda domanda che decide il regime, e su una fattura si vede: la
 *  merce ha dei pezzi, un peso, una spedizione e un codice doganale; un
 *  servizio ha un periodo, un canone, una campagna. Torna `""` quando le spie
 *  non ci sono o si contraddicono — e allora NON si sceglie: proporre «merce»
 *  su una fattura di pubblicità farebbe uscire un TD18 al posto di un TD17. */
function beniOServizi(t: string): "beni" | "servizi" | "" {
  const beni =
    /\b(pcs|pieces|pezzi|quantit[ày]|q\.?t[ày]|unit[àa]?|units|articol\w*|peso|weight|kg\b|shipping|spedizione|consegn\w*|deliver\w*|trasporto|freight|hs\s*code|dogana|customs|carton|packing|tracking)\b/i;
  const servizi =
    /\b(servizi[oi]?|service|advertis\w*|pubblicit[àa]|campagn\w*|abbonament\w*|subscription|licen[sz]\w*|consulen\w*|consulting|hosting|canone|fee\b|impression|click)\b/i;
  const b = beni.test(t);
  const sv = servizi.test(t);
  if (b === sv) return "";
  return b ? "beni" : "servizi";
}

/** Il nome di chi la manda, quando non è uno dei fornitori noti: la prima riga
 *  che porta una forma societaria. ⚠️ NON la prima riga e basta — in cima a un
 *  PDF ci sta il logo, la parola «INVOICE», un numero d'ordine. */
function nomeDelFornitore(t: string): string {
  const forme =
    /\b(s\.?r\.?l\.?s?\.?|s\.?p\.?a\.?|s\.?a\.?s\.?|s\.?n\.?c\.?|ltd\.?|limited|llc|inc\.?|corp\.?|gmbh|b\.?\s?v\.?|s\.?\s?[aà]\.?\s?r\.?\s?l\.?|co\.,?\s*ltd|plc|oy|ab\b|a\/s|aps|nv\b|sl\b|s\.t\.p\.?)/i;
  //  ⚠️ Le righe che cominciano con una di queste NON sono ragioni sociali:
  //   sono etichette, e la sigla societaria ci finisce dentro per caso —
  //   «Order 90231-AB» finisce per «AB», che è la S.p.A. svedese.
  const etichette =
    /^(order|invoice|fattura|documento|date|data|ref|rif|numero|n\.|page|tax|vat|p\.?\s?iva)\b/i;
  for (const riga of t.split(/\n|(?<=\.)\s{2,}/).slice(0, 40)) {
    const r = riga.trim();
    if (r.length < 4 || r.length > 90) continue;
    if (etichette.test(r)) continue;
    if (!forme.test(r)) continue;
    /*  Una ragione sociale ha almeno due PAROLE vere oltre alla sigla: senza
        questo controllo qualunque riga con dentro «ab» o «sl» passerebbe.
        ⚠️ Due lettere bastano a fare una parola: «Amazon EU S.a r.l.» ne ha
         una sola di tre lettere o più, e con la soglia a tre restava senza
         nome proprio uno dei fornitori più frequenti. */
    const parole = r.match(/[A-Za-zÀ-ÿ]{2,}/g) ?? [];
    if (parole.length < 2) continue;
    return r.replace(/\s{2,}/g, " ");
  }
  return "";
}

/** ── COSA HAI COMPRATO ────────────────────────────────────────────────────
 *  La riga che dice l'oggetto dell'acquisto: «Facebook Ads», «Human hair
 *  bundles 200 pcs», «Rifacimento controsoffitto». Senza, in contabilità
 *  restava solo il nome del fornitore, e fra sei mesi «Shenzhen Hair Co. ·
 *  3.730 €» non risponde più alla domanda per cui la si va a cercare.
 *
 *  ⚠️ SI GUARDA SOLO DOPO L'INTESTAZIONE. Le righe utili stanno fra i dati del
 *   documento (numero, data) e i totali: prima ci sono la ragione sociale e
 *   l'indirizzo, che passerebbero tutti i controlli — «Merrion Road, Dublin 4,
 *   Ireland» è fatta di parole vere — e finirebbero in contabilità come
 *   descrizione dell'acquisto. */
function cosaHaiComprato(t: string, dopo: string[]): string {
  const righe = t.split("\n").map((r) => r.trim());
  //  Da dove cominciare: la prima riga che porta la data o il numero, cioè la
  //  fine dell'intestazione. Se non si trovano, si parte dopo un terzo del
  //  documento — sempre meglio che dall'indirizzo.
  /*  ⚠️ LA PRIMA ANCORA, NON L'ULTIMA. Prendevo la più in basso fra numero e
      data, pensando che così finisse tutta l'intestazione. Ma su una fattura
      stampata il numero può stare in FONDO alla pagina, nel piè di pagina: lì
      l'ancora finiva all'ultima riga e non restava più niente da leggere.
      La prima delle due chiude comunque il blocco dell'anagrafica, che è tutto
      quello che serviva scavalcare. */
  let da = -1;
  for (const ancora of dopo.filter(Boolean)) {
    const i = righe.findIndex((r) => r.includes(ancora));
    if (i >= 0 && (da < 0 || i < da)) da = i;
  }
  /*  ⚠️ E UN'ANCORA CHE CADE IN FONDO NON VALE. La data che si propone è
      normalizzata («2026-08-30») e sulla pagina può essere scritta in un altro
      modo («30 agosto 2026»): allora l'unica ancora che si trova è il numero,
      che su una fattura impaginata sta nel piè di pagina. Presa alla lettera,
      l'intestazione «finirebbe» all'ultima riga e non resterebbe niente da
      leggere. Oltre i due terzi della pagina si torna al terzo, che è dove
      finisce l'anagrafica su qualunque impaginazione. */
  if (da < 0 || da > righe.length * 0.6) da = Math.floor(righe.length / 3);

  /*  ⚠️ CON I CONFINI DI PAROLA, e non è pedanteria: senza il `\b`, «rif»
      scartava «Rifacimento controsoffitto» — cioè proprio la riga che dice
      cosa è stato comprato, su una fattura edile. Le sigle corte di questo
      elenco stanno dentro decine di parole normali. */
  /*  ⚠️ ANCHE I BLOCCHI DI CHI COMPRA E CHI VENDE, e non c'erano: sulla prima
      fattura cinese vera il campo «cosa hai comprato» si riempiva con «The
      Buyer: · Hair Genius Labs», cioè con il NOME DI CHI LA RICEVE. Un campo
      pieno di una cosa sbagliata è peggio di un campo vuoto: vuoto lo si
      compila, sbagliato lo si conferma.
      Il `(the\s+)?` iniziale serve perché in inglese quelle righe cominciano
      quasi sempre con l'articolo — «The Buyer», «The Seller» — e ancorate
      senza di lui non le prendeva nessuna. */
  const salta =
    /^(the\s+)?(fattura|invoice|tax\s|credit\s|nota\s|order\b|ordine\b|rif\b|ref\b|date\b|data\b|datum\b|fecha\b|p\.?\s?iva\b|partita\s|iva\b|vat\b|ust-?id|codice\s*fiscale|via\s|viale\s|piazza\s|street\b|str\.|strasse|road\b|cap\s|tel\b|e-?mail\b|iban\b|pec\b|swift\b|subtotal|sub-total|totale\b|total\b|amount\b|net\b|netto\b|imponibile\b|imposta\b|shipping\b|shipment\b|packing\b|spedizione\b|imballo\b|freight\b|weight\b|peso\b|reverse\b|inversione\b|pagamento\b|payment\b|scadenza\b|due\b|page\b|pag\.|unit\b|price\b|prezzo\b|quantity\b|qty\b|quantit|picture\b|immagine\b|item\s+no|buyer\b|seller\b|consignee\b|shipper\b|bill\s+to\b|ship\s+to\b|sold\s+to\b|issued\s+by\b|destinatario\b|mittente\b|cliente\b|country\s+of\s+origin\b|origin\b|delivery\b|declaration|signature|paypal\b|website\b|web\s?site\b|http)/i;
  const scelte: string[] = [];
  /*  ── ⚠️ QUELLO CHE STA SOTTO UN'ETICHETTA APPARTIENE ALL'ETICHETTA ─────
      «The Buyer:» si scarta, ma la riga DOPO — che è il nome del cliente —
      passava tutti i controlli e finiva nel campo «cosa hai comprato». Sui
      fogli di calcolo succede sempre, perché ogni cella è una riga a sé e
      l'etichetta non sta mai accanto al suo valore.
      La regola è stretta apposta: vale solo dopo una riga che è GIÀ stata
      scartata E che finisce con i due punti (anche quelli larghi, «：», che
      usano i fornitori asiatici). Una riga qualunque che finisce con i due
      punti non basta: dev'essere una delle etichette conosciute. */
  let dopoEtichetta = false;
  for (const r of righe.slice(da + 1)) {
    const etichetta = salta.test(r) && /[:：]\s*$/.test(r);
    if (r.length < 8 || r.length > 90) {
      dopoEtichetta = etichetta;
      continue;
    }
    if (salta.test(r)) {
      dopoEtichetta = etichetta;
      continue;
    }
    if (dopoEtichetta) {
      //  Il valore di quell'etichetta: si salta, e l'etichetta è consumata.
      dopoEtichetta = false;
      continue;
    }
    const lettere = r.replace(/[^A-Za-zÀ-ÿ]/g, "").length;
    const cifre = r.replace(/\D/g, "").length;
    //  Una riga fatta più di numeri che di lettere è un importo, un codice, un
    //  numero d'ordine: non descrive niente.
    if (lettere < 6 || cifre >= lettere) continue;
    if ((r.match(/[A-Za-zÀ-ÿ]{3,}/g) ?? []).length < 2) continue;
    /*  ⚠️ TUTTO MAIUSCOLO E CORTO = UN'ETICHETTA, NON UNA DESCRIZIONE.
        Su una fattura impaginata a colonne le intestazioni sono in maiuscolo
        — «ID ORDINE», «CAUSALE DEL BONIFICO», «EMESSA DA» — e passano tutti
        gli altri controlli: sono parole vere, senza cifre, più d'una. Quello
        che si è comprato è quasi sempre scritto normale.
        Il prezzo di questa regola è una fattura che scrive «FORNITURA CAPELLI
        200 PZ» in maiuscolo: lì il campo resta vuoto e lo si scrive a mano —
        che è meglio di un campo pieno con scritto «CAUSALE DEL BONIFICO». */
    if (r === r.toUpperCase() && (r.match(/[A-Za-zÀ-ÿ]{2,}/g) ?? []).length <= 4) continue;
    scelte.push(r.replace(/^(descri\w*|description)\s*[:-]?\s*/i, ""));
    if (scelte.length === 2) break;
  }
  return scelte.join(" · ");
}

/** ── ⚠️ 03/04/2026: TRE APRILE O QUATTRO MARZO? ───────────────────────────
 *  Le due forme si scrivono uguali, e sbagliarle sposta il costo di un mese —
 *  cioè, molto spesso, di un trimestre: la liquidazione IVA esce sbagliata da
 *  tutte e due le parti.
 *  A disambiguare non è il numero, è CHI HA SCRITTO IL DOCUMENTO. In Italia,
 *  Germania, Francia, Spagna il giorno viene prima, sempre; negli Stati Uniti
 *  viene prima il mese. Quando si sa da dove arriva la fattura, la data si
 *  può leggere; quando non si sa, e il giorno è ≤ 12, NON si propone niente e
 *  la scrive chi ha il documento davanti.
 *  ⚠️ Non si indovina «tanto sarà europea»: il caso in cui questo programma
 *   lavora di più sono proprio le fatture estere. */
function dataDa(testo: string, paese?: string): string {
  //  L'anno davanti non è ambiguo in nessun paese del mondo.
  const iso = testo.match(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (iso) {
    return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  }
  const MESI: Record<string, string> = {
    gen: "01",
    feb: "02",
    mar: "03",
    apr: "04",
    mag: "05",
    giu: "06",
    lug: "07",
    ago: "08",
    set: "09",
    ott: "10",
    nov: "11",
    dic: "12",
    jan: "01",
    may: "05",
    jun: "06",
    jul: "07",
    aug: "08",
    sep: "09",
    oct: "10",
    dec: "12",
  };
  //  Il mese scritto a parole non è ambiguo: «12 agosto 2026», «Aug 12, 2026».
  const esteso = testo.match(/\b(\d{1,2})\s+([A-Za-z]{3})[a-z]*\.?,?\s+(20\d{2})\b/);
  if (esteso) {
    const m = MESI[esteso[2].toLowerCase()];
    if (m) return `${esteso[3]}-${m}-${esteso[1].padStart(2, "0")}`;
  }
  const inglese = testo.match(/\b([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(20\d{2})\b/);
  if (inglese) {
    const m = MESI[inglese[1].toLowerCase()];
    if (m) return `${inglese[3]}-${m}-${inglese[2].padStart(2, "0")}`;
  }

  const barre = testo.match(/\b(\d{1,2})[/.](\d{1,2})[/.](20\d{2})\b/);
  if (!barre) return "";
  const a = Number(barre[1]);
  const b = Number(barre[2]);
  const anno = barre[3];
  const gm = (g: number, m: number) =>
    m >= 1 && m <= 12 && g >= 1 && g <= 31
      ? `${anno}-${String(m).padStart(2, "0")}-${String(g).padStart(2, "0")}`
      : "";
  //  Uno dei due numeri sopra il dodici scioglie il dubbio da solo.
  if (a > 12) return gm(a, b);
  if (b > 12) return gm(b, a);

  const p = String(paese ?? "")
    .trim()
    .toUpperCase();
  //  Quasi tutto il mondo scrive prima il giorno; gli Stati Uniti no. Si
  //  elencano i paesi in cui il MESE viene prima, che sono pochi e noti,
  //  invece degli altri, che sono duecento.
  const MESE_DAVANTI = new Set(["US", "PH", "FM", "PW"]);
  if (p && MESE_DAVANTI.has(p)) return gm(b, a);
  //  Sappiamo da dove arriva, e non è uno di quelli: il giorno viene prima.
  if (p) return gm(a, b);
  //  Non sappiamo da dove arriva e i due numeri sono intercambiabili: si tace.
  return "";
}

export function proponiDalTesto(
  testo: string,
  /** Partita IVA e codice fiscale della NOSTRA società: servono a una cosa
   *  sola e importante — accorgersi di aver caricato una nostra fattura. */
  nostri?: { partitaIva?: string; codiceFiscale?: string; denominazione?: string },
): Proposta {
  const p: Proposta = { spiega: [] };
  const t = String(testo ?? "");

  /*  ── ⚠️ PRIMA DI TUTTO: È UNA FATTURA, O SOLO L'ARIA DI UNA? ───────────
      Si guarda per primo perché cambia il senso di ogni campo che viene dopo:
      su una proforma il «numero» non è un numero di fattura, la «data» non è
      una data di operazione, e l'imponibile non va in nessun registro. Dirlo
      in fondo, dopo aver riempito tutto, vorrebbe dire farlo leggere a chi ha
      già premuto conferma. */
  if (eProforma(t)) {
    p.proforma = true;
    p.spiega.push(
      "Questo documento dice di essere una PROFORMA: non è una fattura e non si registra. Serve a pagare; il costo si segue lo stesso, ma per la contabilità ci vuole la fattura definitiva del fornitore.",
    );
  }

  /*  ── ⚠️ CHI L'HA EMESSA, NOI O IL FORNITORE? ──────────────────────────
      La nostra partita IVA compare su TUTTE e due: su una fattura ricevuta
      perché siamo il cliente, su una nostra perché siamo chi la emette. A
      distinguerle è la POSIZIONE: il blocco di chi emette viene prima di
      quello di chi riceve, su qualunque fattura al mondo. Se la nostra
      partita IVA sta prima delle parole «intestata a», «cliente»,
      «cessionario», quella fattura l'abbiamo emessa noi. */
  const cifre = (v?: string) => String(v ?? "").replace(/\D/g, "");
  const nostriCodici = [cifre(nostri?.partitaIva), cifre(nostri?.codiceFiscale)].filter(
    (x) => x.length >= 8,
  );
  if (nostriCodici.length > 0) {
    const senzaSpazi = t.replace(/[\s.\-/]/g, "");
    const dove = nostriCodici.map((c) => senzaSpazi.indexOf(c)).filter((i) => i >= 0);
    if (dove.length > 0) {
      const nostra = Math.min(...dove);
      const marcatore = senzaSpazi.search(
        /(intestataa|cessionariocommittente|cliente|destinatario|billto|invoiceto|customer|soldto)/i,
      );
      if (marcatore < 0 || nostra < marcatore) {
        p.emessaDaNoi = true;
        p.spiega.push(
          "⚠️ Questa fattura l'hai emessa TU: sul documento la partita IVA della tua società sta dalla parte di chi la manda, non di chi la riceve. Caricandola qui un tuo ricavo diventerebbe un costo.",
        );
      }
    }
  }

  /*  ⚠️ L'INTESTAZIONE SONO LE PRIME TRE RIGHE, non i primi N caratteri.
      Avevo scritto 400 caratteri e la prova è rimasta rossa: su una fattura
      corta «Shipping DHL» ci sta dentro comunque. Le righe invece separano
      quello che serve separare — chi EMETTE la fattura sta scritto in cima,
      alla prima riga, e quello che compare più giù è merce o servizi comprati
      da qualcun altro. Tre e non una per lasciare spazio a un logo o a una
      riga vuota davanti al nome.
      Vedi `soloInTesta`. */
  const testa = t.split("\n").slice(0, 3).join("\n");
  const noto = NOTI.find((x) => x.chi.test(x.soloInTesta ? testa : t));
  if (noto) {
    if (noto.nome) p.fornitore = noto.nome;
    p.paese = noto.paese;
    p.regime = noto.regime;
    if (noto.piva) p.partitaIva = noto.piva;
    p.spiega.push(noto.perche);
  }

  //  La partita IVA europea si riconosce dalla forma, e la sua sigla dice il
  //  paese meglio di qualunque parola nel testo.
  if (!p.partitaIva) {
    /*  ⚠️ ALMENO DUE CIFRE, o «DESCRIZIONE» è una partita IVA tedesca.
        Sul serio: «DE» + «SCRIZIONE» sono due lettere di paese seguite da
        nove caratteri maiuscoli, cioè esattamente la forma di una partita IVA
        europea. Su una fattura italiana vera bastava quella parola per far
        risultare il fornitore in Germania, e da lì il regime diventava
        «servizi da un fornitore UE». Nessuna partita IVA al mondo è fatta di
        sole lettere. */
    const piva = t
      .match(
        /\b(AT|BE|BG|HR|CY|CZ|DK|EE|FI|FR|DE|EL|GR|HU|IE|LV|LT|LU|MT|NL|PL|PT|RO|SK|SI|ES|SE)[\s-]?([0-9A-Z]{8,12})\b/g,
      )
      ?.map((x) => /^(..)[\s-]?(.+)$/.exec(x))
      .find((m) => m && (m[2].match(/\d/g) ?? []).length >= 2);
    if (piva) {
      p.partitaIva = `${piva[1]}${piva[2]}`;
      //  ⚠️ EL è la sigla IVA della Grecia, il cui codice paese è GR: sono due
      //   alfabeti diversi per la stessa cosa, e chi non lo sa scrive «EL» in
      //   un campo paese dove nessuna tabella lo riconosce.
      if (!p.paese) p.paese = piva[1] === "EL" ? "GR" : piva[1];
    }
  }
  /*  ⚠️ LA PARTITA IVA ITALIANA NON HA LA SIGLA DAVANTI. Il controllo qui
      sopra cerca la forma europea — IE9692928F, DE811907980 — e su una
      fattura italiana non trova niente, perché lì ci sono undici cifre e
      basta. Si riconosce dalla parola che la precede, non dalla forma: undici
      cifre di fila su una fattura sono anche un IBAN spezzato, un numero
      d'ordine, un codice cliente. */
  if (!p.partitaIva) {
    const ita = t.match(/(?:p\.?\s?iva|partita\s*iva)\b[^\d\n]{0,12}(\d{11})\b/i);
    if (ita) {
      p.partitaIva = ita[1];
      if (!p.paese) p.paese = "IT";
    }
  }
  if (!p.paese && /\bP\.?\s?IVA\b|partita iva|codice fiscale/i.test(t)) p.paese = "IT";
  /*  ── IL PAESE SCRITTO A PAROLE ─────────────────────────────────────────
      Un fornitore americano o inglese non ha nessuna partita IVA europea da
      cui ricavare la sigla: il suo paese sta nell'indirizzo, scritto per
      esteso. Serve a due cose che contano — proporre il regime giusto
      (extra-UE) e, soprattutto, sciogliere «05/03/2026»: negli Stati Uniti
      quello è il tre maggio, in Europa il cinque marzo.
      ⚠️ Solo nomi INTERI e inequivocabili: «China» sì, «CN» no — due lettere
       maiuscole in una fattura sono anche una sigla di stato, un codice
       prodotto, le iniziali di qualcuno. */
  if (!p.paese) {
    const NOMI: [RegExp, string][] = [
      [/\b(united states|u\.s\.a\.|usa\b|stati uniti)/i, "US"],
      [/\b(united kingdom|england|regno unito)\b/i, "GB"],
      [/\b(china|p\.?r\.? china|cina)\b/i, "CN"],
      [/\b(switzerland|svizzera|schweiz)\b/i, "CH"],
      [/\b(hong kong)\b/i, "HK"],
      [/\b(singapore)\b/i, "SG"],
      [/\b(japan|giappone)\b/i, "JP"],
      [/\b(india)\b/i, "IN"],
      [/\b(canada)\b/i, "CA"],
      [/\b(australia)\b/i, "AU"],
      [/\b(t[üu]rkiye|turkey|turchia)\b/i, "TR"],
      [/\b(ireland|irlanda)\b/i, "IE"],
      [/\b(deutschland|germany|germania)\b/i, "DE"],
      [/\b(luxembourg|lussemburgo)\b/i, "LU"],
      [/\b(nederland|netherlands|paesi bassi)\b/i, "NL"],
      [/\b(espa[ñn]a|spain|spagna)\b/i, "ES"],
      [/\b(france|francia)\b/i, "FR"],
      [/\b(italia|italy)\b/i, "IT"],
    ];
    for (const [re, sigla] of NOMI) {
      if (re.test(t)) {
        p.paese = sigla;
        break;
      }
    }
  }
  if (!p.fornitore) {
    const nome = nomeDelFornitore(t);
    if (nome) p.fornitore = nome;
    else p.spiega.push("Il nome del fornitore non si è riconosciuto: scrivilo tu.");
  }

  //  ⚠️ LA DATA SI LEGGE DOPO IL PAESE, e non è un dettaglio d'ordine: su
  //   «03/04/2026» il paese è l'unica cosa che dice se è il tre aprile o il
  //   quattro marzo. Spostando questa riga più in alto si torna a rifiutare
  //   la data di metà delle fatture italiane.
  const d = dataDa(t, p.paese);
  if (d) p.data = d;
  else
    p.spiega.push(
      "La data non si è potuta leggere con sicurezza — su «03/04» non si sa se è il 3 aprile o il 4 marzo, e sbagliarla sposta il costo di trimestre. Scrivila tu.",
    );

  //  ⚠️ PRIMA LE FORME ESPLICITE, POI QUELLE VAGHE. «No.» da solo compare
  //   anche in «VAT Reg. No. IE9692928F», e con un solo tentativo il numero
  //   della fattura di Meta diventava la sua partita IVA — un numero
  //   plausibile, scritto nel campo sbagliato, che nessuno avrebbe ricontrollato.
  /*  ⚠️ E L'ETICHETTA DA SOLA SU UNA RIGA, con il numero sotto. È come lo
      scrive questo stesso CRM sulle sue fatture, e mezzo mondo con lui:
        FATTURA
        2026/0001
      Cercando «fattura n.» non si trova niente, perché la «n.» non c'è.
      ⚠️ L'etichetta dev'essere SOLA sulla sua riga (`^…$`): senza
       quell'ancoraggio «DATA FATTURA» diventerebbe un'etichetta di numero, e
       il numero della fattura sarebbe la data. */
  const righe = t.split("\n").map((r) => r.trim());
  for (let i = 0; i < righe.length - 1 && !p.numero; i++) {
    if (
      !/^(fattura|invoice|nota di credito|credit note|documento|numero|n\.|n°)$/i.test(righe[i])
    ) {
      continue;
    }
    const dopo = righe[i + 1].match(/^([A-Za-z0-9][A-Za-z0-9/._-]{3,24})$/);
    //  Deve contenere una cifra: «Elettronica» sotto «FATTURA» non è un numero.
    if (dopo && /\d/.test(dopo[1])) p.numero = dopo[1];
  }

  for (const re of [
    //  Anche il numero di una nota di credito: si chiama in un altro modo, e
    //  senza questa riga restava da scrivere a mano proprio sui documenti che
    //  il programma aveva appena riconosciuto da solo.
    /*  ⚠️ `[ \t]*` E NON `\s*` FRA LE PAROLE. `\s` comprende l'a capo, e su
        una fattura che porta «Credit Note» come titolo e «Credit note number
        250918…» due righe sotto, il primo pezzo si mangiava l'a capo e
        pescava come numero la parola «Credit» della riga seguente. Il titolo
        e il campo devono stare sulla STESSA riga per contare. */
    /(?:credit[ \t]*(?:note|memo)[ \t]*(?:number|no\.?|#)|nota[ \t]*di[ \t]*credito[ \t]*n(?:umero|\.|°)?|invoice[ \t]*(?:number|no\.?|#)|fattura[ \t]*n(?:umero|\.|°)?|documento[ \t]*n(?:\.|°)?)[^\dA-Z\n]{0,12}([A-Z0-9][A-Z0-9/-]{3,24})/i,
    /(?:^|\n)\s*n(?:umero|\.|°)\s*([A-Z0-9][A-Z0-9/-]{3,24})/i,
  ]) {
    if (p.numero) break;
    const m = t.match(re);
    if (m) {
      p.numero = m[1];
      break;
    }
  }

  //  ⚠️ SI CERCA PRIMA L'IMPONIBILE, POI L'IMPOSTA, E IL TOTALE SOLO PER
  //   CONTROLLO. Su una fattura estera in inversione contabile l'imposta non
  //   c'è e il totale COINCIDE con l'imponibile: prendere il totale e
  //   chiamarlo imponibile sarebbe giusto lì e sbagliato su una fattura
  //   italiana, dove ci finirebbe dentro anche l'IVA.
  const imponibile = importoDopo(
    t,
    "imponibile|subtotal|sub-total|net amount|amount \\(excl|totale imponibile|excluding vat",
  );
  const imposta = importoDopo(t, "iva|vat|tax|imposta");
  const totale = importoDopo(t, "totale|total|amount due|balance due|grand total");

  if (imponibile > 0) p.imponibile = imponibile;
  else if (totale > 0 && imposta <= 0) {
    p.imponibile = totale;
    p.spiega.push(
      "Non c'era una riga «imponibile»: è stato preso il totale. Su una fattura estera senza IVA è la stessa cosa; su una italiana controlla.",
    );
  } else if (totale > 0 && imposta > 0) {
    p.imponibile = Math.round((totale - imposta) * 100) / 100;
    p.spiega.push("L'imponibile è stato ricavato da totale meno imposta: controllalo.");
  }
  if (imposta > 0) p.imposta = imposta;
  //  ⚠️ TRASPORTO E DAZI FANNO PARTE DEL COSTO. Su una fattura estera il
  //   totale è spesso più alto dell'imponibile senza che ci sia di mezzo
  //   nessuna IVA: in mezzo ci stanno la spedizione e le commissioni, che sono
  //   costo deducibile a tutti gli effetti — e su un'importazione entrano
  //   perfino nel valore su cui la dogana calcola i suoi diritti. Proporre il
  //   solo imponibile e tacere farebbe registrare meno di quello che è uscito.
  if (totale > 0 && p.imponibile != null && totale - p.imponibile - imposta > 0.5) {
    p.spiega.push(
      `Nel documento il totale (${totale.toLocaleString("it-IT", { minimumFractionDigits: 2 })}) supera l'imponibile di quanto non sia l'imposta: di mezzo ci sono spedizione, dazi o commissioni. Sono costo anche quelli — se li hai pagati, sommali.`,
    );
  }

  /*  ── LA VALUTA ────────────────────────────────────────────────────────
      Si scrive accanto in contabilità, e non converte niente nessuno: vedi la
      nota sul cambio in contabilita-FinestraFornitore.
      ⚠️ PRIMA LA SIGLA, POI IL SIMBOLO. «USD» scritto per esteso è una
       dichiarazione; il «$» può essere anche un dollaro di Hong Kong o
       australiano. Quando c'è la sigla si usa quella. */
  const sigla = t.match(
    /\b(USD|EUR|GBP|CNY|CHF|JPY|CAD|AUD|SEK|NOK|DKK|PLN|CZK|RON|HKD|SGD|AED)\b/,
  );
  let vista = sigla?.[1];
  if (!vista) {
    for (const [re, c] of [
      [/€/, "EUR"],
      [/£/, "GBP"],
      [/\$/, "USD"],
      [/¥/, "CNY"],
    ] as [RegExp, string][]) {
      if (re.test(t)) {
        vista = c;
        break;
      }
    }
  }
  if (!vista) {
    /*  ── ⚠️ LA VALUTA SCRITTA A PAROLE, ERRORI COMPRESI ─────────────────
        Terzo tentativo, e non è pignoleria: la prima fattura vera arrivata da
        un fornitore cinese non ha né la sigla né il simbolo. In fondo c'è
        scritto «Amount Chargeable: US DOLLAS» — con l'errore di battitura del
        fornitore. Senza questo blocco quel documento entrava in contabilità
        come 729,24 EURO invece di 729,24 dollari: un costo gonfiato di
        sessanta euro, in un campo che nessuno ha motivo di ricontrollare
        perché il numero È quello scritto sul documento.
        ⚠️ Si cerca «DOLLA» e non «DOLLAR»: copre DOLLAR, DOLLARS e la forma
         sbagliata, e nessuna parola italiana o inglese di una fattura comincia
         così per caso. */
    for (const [re, c] of [
      [/\b(?:U\.?\s?S\.?|AMERICAN)\s+DOLLA/i, "USD"],
      [/\bDOLLA(?:R|S)\b/i, "USD"],
      [/\b(?:RMB|RENMINBI|YUAN)\b/i, "CNY"],
      [/\bSTERLIN[EG]/i, "GBP"],
      [/\bFRANCH?I?\s+SVIZZER|SWISS\s+FRANC/i, "CHF"],
      [/\bEUROS?\b/i, "EUR"],
    ] as [RegExp, string][]) {
      if (re.test(t)) {
        vista = c;
        break;
      }
    }
  }
  if (vista) p.valutaVista = vista;
  if (vista && vista !== "EUR") {
    p.valuta = vista;
    if (p.imponibile) {
      p.importoValuta = p.imponibile;
      //  ⚠️ L'importo proposto viene azzerato: era in valuta, e lasciarlo nel
      //   campo degli euro scriverebbe in contabilità dei dollari chiamandoli
      //   euro. È il caso in cui una proposta comoda diventa un numero falso.
      p.imponibile = undefined;
      p.imposta = undefined;
      p.spiega.push(
        `Il documento è in ${vista}: l'importo è stato messo nel campo della valuta. In euro scrivi quello che è uscito davvero dal conto, al cambio del giorno.`,
      );
    }
  }

  /*  ── ⚠️ È UN RIMBORSO, NON UNA SPESA ──────────────────────────────────
      Meta emette accrediti pubblicitari, Amazon note di credito sui resi, i
      fornitori italiani note di credito per gli sconti a posteriori. Nel
      documento gli importi sono POSITIVI: a dire che vanno sottratti è il
      titolo. Registrata come una fattura normale gonfia i costi e gonfia
      l'IVA a credito, cioè fa risultare meno imposte di quelle dovute — e non
      si scopre da soli, perché il conto sembra più bello. */
  if (
    /(nota\s*di\s*credito|credit\s*(note|memo)|gutschrift|avoir|nota\s*de\s*cr[ée]dito|refund|rimborso|storno)/i.test(
      t,
    )
  ) {
    p.notaDiCredito = true;
    p.spiega.push(
      "Sembra una NOTA DI CREDITO, cioè un rimborso: in contabilità toglie invece di aggiungere. Controlla che sia davvero così prima di salvare.",
    );
  }

  //  L'aliquota, quando il documento la scrive: serve per autoliquidare con il
  //  numero giusto invece che con il 22% di ripiego.
  const aliq = t.match(/\b(\d{1,2})(?:[.,]\d)?\s*%/);
  if (aliq) {
    const v = Number(aliq[1]);
    //  ⚠️ Solo le aliquote che esistono in Italia: in una fattura ci sono
    //   anche sconti «-10%» e percentuali di ogni genere, e prenderne una a
    //   caso farebbe autoliquidare una cifra inventata.
    if ([4, 5, 10, 22].includes(v)) p.aliquota = v;
  }

  /*  ── ⚠️ LE PAROLE CHE DICONO DA SOLE COME VA TRATTATA ─────────────────
      «Reverse charge», «VAT to be accounted by the customer», «art. 7-ter»:
      quando ci sono, il fornitore ti sta dicendo lui che l'IVA la devi mettere
      tu. È l'indizio più affidabile che ci sia su un PDF — più del paese, che
      può essere quello della sede e non quello di chi fattura. */
  const dice =
    /reverse\s*charge|inversione\s*contabile|accounted\s*(for\s*)?by\s*the\s*(customer|recipient)|art(icolo)?\.?\s*7-?ter|art(icolo)?\.?\s*17\b|not\s*subject\s*to\s*vat|non\s*soggett\w+\s*a\s*iva/i.test(
      t,
    );
  const cosa = beniOServizi(t);
  const zona = p.paese ? zonaDelPaese(p.paese) : "";

  if (!p.regime) {
    if (zona === "IT") {
      p.regime = dice ? "reverse_interno" : "italiana";
      if (dice)
        p.spiega.push(
          "Fornitore italiano che non addebita l'IVA: sul documento c'è scritto «inversione contabile».",
        );
    } else if (zona === "UE" || zona === "EXTRA") {
      const servizi = cosa !== "beni";
      p.regime =
        zona === "UE"
          ? servizi
            ? "ue_servizi"
            : "ue_beni"
          : servizi
            ? "estero_servizi"
            : "importazione";
      p.spiega.push(
        cosa
          ? `Sul documento si legge che hai comprato ${cosa === "beni" ? "MERCE" : "un SERVIZIO"}: da lì è stata scelta la riga. Se non è così, cambiala.`
          : "Dal documento non si capisce se hai comprato merce o un servizio: è stato proposto «servizi». Se sono scatole arrivate con un corriere, cambia riga.",
      );
    }
  }
  /*  ⚠️ SU UN REGIME CHE NON ESPONE IVA L'IMPOSTA PROPOSTA SI CANCELLA.
      Su una fattura in inversione contabile il fornitore non addebita niente,
      e qualunque cifra riconosciuta accanto alla parola «IVA» è un'altra cosa
      — un'aliquota, il numero di un articolo, un totale di un'altra riga.
      Lasciarla nel campo vorrebbe dire mostrare un'imposta che non esiste
      accanto a una riga che dice di non averne. */
  if (p.regime && p.regime !== "italiana") p.imposta = undefined;

  if (dice && p.regime === "italiana") {
    p.spiega.push(
      "Attenzione: sul documento compaiono le parole dell'inversione contabile, ma il regime proposto è quello italiano ordinario. Controlla.",
    );
  }

  const descrizione = cosaHaiComprato(t, [p.numero ?? "", p.data ?? "", ""].filter(Boolean));
  if (descrizione) p.descrizione = descrizione;
  else
    p.spiega.push(
      "Non si è capito cosa è stato comprato: scrivilo tu, o resta solo il nome del fornitore.",
    );

  return p;
}
