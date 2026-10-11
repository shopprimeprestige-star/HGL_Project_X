/** ── LEGGERE UN FOGLIO DI CALCOLO CHE ARRIVA DA UN FORNITORE ───────────────
 *
 *  I fornitori esteri le fatture le mandano come capita: PDF, XML, e — quelli
 *  cinesi quasi sempre — un foglio Excel. Il primo che è arrivato è un
 *  «PROFORMA INVOICE» di un fornitore di Qingdao, in `.xls` del 2005, scritto
 *  da Excel in cinese.
 *
 *  Restituisce del TESTO, e si ferma lì: i campi li propone
 *  `proponiDalTesto` (crm/contabilita-pdf), lo stesso che legge i PDF. Un
 *  secondo riconoscitore per i fogli di calcolo vorrebbe dire due idee diverse
 *  di che cos'è un imponibile, e la differenza si scoprirebbe in dichiarazione.
 *
 *  ── ⚠️ DUE FORMATI CHE SI CHIAMANO UGUALE ────────────────────────────────
 *   · `.xlsx` è un ZIP di XML: si scompatta e si leggono le stringhe. Facile.
 *   · `.xls` è un COMPOUND FILE OLE2 del 1997 con dentro un flusso di record
 *     binari (BIFF8). Niente ZIP, niente XML: settori da 512 byte, una FAT che
 *     dice in che ordine leggerli, e le stringhe in una tabella condivisa.
 *  Qui ci sono tutti e due, perché il file vero che è arrivato è il secondo e
 *  quello che arriverà domani sarà il primo.
 *
 *  ── ⚠️ SI LEGGE SOLO IL TESTO, NON LA GRIGLIA ────────────────────────────
 *  Non si ricostruiscono righe e colonne: servirebbe interpretare la
 *  formattazione, e un foglio fatto a mano da un fornitore non ha una griglia
 *  affidabile — celle unite, righe vuote, intestazioni scritte dentro il
 *  contenuto. Si estraggono i testi e i numeri nell'ordine in cui stanno nel
 *  file, una cella per riga, e il riconoscitore ci lavora come su un PDF.
 *  ───────────────────────────────────────────────────────────────────────── */
import type { LetturaPdf } from "./contabilita-pdf";

const td = (etichetta: string) => new TextDecoder(etichetta as "utf-8");

/* ═══════════════════════════════════════════════════════════════════════════
   1. .xlsx — uno ZIP di XML
   ═════════════════════════════════════════════════════════════════════════ */

/** Trova un file dentro uno ZIP e lo restituisce scompattato.
 *  ⚠️ Si legge la CENTRAL DIRECTORY, non le intestazioni locali: quelle
 *   possono dichiarare lunghezza 0 e rimandare a un descrittore che sta DOPO i
 *   dati, e chi le legge in avanti si perde. La directory in coda invece
 *   dichiara sempre le misure vere. */
async function daZip(dati: ArrayBuffer, quali: RegExp): Promise<string[]> {
  const b = new Uint8Array(dati);
  const dv = new DataView(dati);
  //  La fine della central directory: si cerca la firma all'indietro.
  let fine = -1;
  for (let i = b.length - 22; i >= 0 && i > b.length - 66000; i--) {
    if (dv.getUint32(i, true) === 0x06054b50) {
      fine = i;
      break;
    }
  }
  if (fine < 0) return [];
  const quante = dv.getUint16(fine + 10, true);
  let p = dv.getUint32(fine + 16, true);
  const fuori: string[] = [];

  for (let n = 0; n < quante && p + 46 <= b.length; n++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const metodo = dv.getUint16(p + 10, true);
    const compressa = dv.getUint32(p + 20, true);
    const lunNome = dv.getUint16(p + 28, true);
    const lunExtra = dv.getUint16(p + 30, true);
    const lunCommento = dv.getUint16(p + 32, true);
    const inizioLocale = dv.getUint32(p + 42, true);
    const nome = td("utf-8").decode(b.subarray(p + 46, p + 46 + lunNome));
    p += 46 + lunNome + lunExtra + lunCommento;
    if (!quali.test(nome)) continue;

    //  Dall'intestazione locale si ricavano SOLO le lunghezze dei suoi campi
    //  variabili, per sapere dove cominciano i dati.
    const lNome = dv.getUint16(inizioLocale + 26, true);
    const lExtra = dv.getUint16(inizioLocale + 28, true);
    const dati0 = inizioLocale + 30 + lNome + lExtra;
    const crudi = b.subarray(dati0, dati0 + compressa);
    if (metodo === 0) {
      fuori.push(td("utf-8").decode(crudi));
      continue;
    }
    try {
      //  `deflate-raw`: dentro uno ZIP il flusso non ha l'involucro zlib.
      const s = new Blob([crudi]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
      fuori.push(await new Response(s).text());
    } catch {
      /* un pezzo illeggibile non deve portarsi via tutto il resto */
    }
  }
  return fuori;
}

/** Il testo di un .xlsx: le stringhe condivise più i valori scritti in linea. */
async function testoXlsx(dati: ArrayBuffer): Promise<string> {
  const pezzi = await daZip(dati, /^xl\/(sharedStrings\.xml|worksheets\/sheet\d+\.xml)$/);
  if (pezzi.length === 0) return "";
  const righe: string[] = [];
  for (const x of pezzi) {
    //  ⚠️ `<t>` sta sia in sharedStrings sia nelle celle di tipo «inline»; `<v>`
    //   sono i numeri. Si prendono tutti e due nell'ordine in cui compaiono.
    for (const m of x.matchAll(/<t[^>]*>([\s\S]*?)<\/t>|<v>([\s\S]*?)<\/v>/g)) {
      const v = (m[1] ?? m[2] ?? "").replace(/<[^>]*>/g, "");
      if (v.trim()) righe.push(sciogli(v));
    }
  }
  return righe.join("\n");
}

const sciogli = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");

/* ═══════════════════════════════════════════════════════════════════════════
   2. .xls — il compound file OLE2, e dentro i record BIFF8
   ═══════════════════════════════════════════════════════════════════════════
   Un .xls non è un file: è un piccolo FILE SYSTEM. In testa una firma, poi
   settori da 512 byte, una tabella (la FAT) che dice quale settore segue
   quale, e una directory che elenca i «flussi» dentro. A noi serve solo il
   flusso che si chiama «Workbook».
   ⚠️ I flussi piccoli (sotto 4096 byte) non stanno nei settori normali ma in
    un mini-flusso con una mini-FAT sua. Il Workbook di una fattura è sempre
    più grande, quindi qui si gestisce solo il caso normale — e se non lo è si
    dice che non si è saputo leggere, invece di restituire byte a caso. */

const FIRMA_OLE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

function flussoWorkbook(dati: ArrayBuffer): Uint8Array | null {
  const b = new Uint8Array(dati);
  if (b.length < 512 || FIRMA_OLE.some((v, i) => b[i] !== v)) return null;
  const dv = new DataView(dati);
  const misuraSettore = 1 << dv.getUint16(30, true);
  const setDaOffset = (s: number) => 512 + s * misuraSettore;

  //  ── LA FAT ──────────────────────────────────────────────────────────────
  //  I primi 109 settori della FAT stanno in testa; se ce ne sono altri, si
  //  seguono i settori DIFAT. Una fattura non arriva mai a tanto, ma leggerli
  //  costa dieci righe e senza di quelli un file grande si legge a metà.
  const nFat = dv.getUint32(44, true);
  const listaFat: number[] = [];
  for (let i = 0; i < Math.min(nFat, 109); i++) listaFat.push(dv.getUint32(76 + i * 4, true));
  let dif = dv.getUint32(68, true);
  const perSettore = misuraSettore / 4;
  let guardia = 0;
  while (dif !== 0xfffffffe && dif !== 0xffffffff && guardia++ < 1000) {
    const o = setDaOffset(dif);
    if (o + misuraSettore > b.length) break;
    for (let i = 0; i < perSettore - 1; i++) {
      const v = dv.getUint32(o + i * 4, true);
      if (v !== 0xffffffff) listaFat.push(v);
    }
    dif = dv.getUint32(o + (perSettore - 1) * 4, true);
  }
  const fat: number[] = [];
  for (const s of listaFat) {
    const o = setDaOffset(s);
    if (o + misuraSettore > b.length) continue;
    for (let i = 0; i < perSettore; i++) fat.push(dv.getUint32(o + i * 4, true));
  }

  const catena = (primo: number, limite: number): Uint8Array => {
    const pezzi: Uint8Array[] = [];
    let s = primo;
    let letti = 0;
    let g = 0;
    while (s !== 0xfffffffe && s !== 0xffffffff && g++ < 100000) {
      const o = setDaOffset(s);
      if (o + misuraSettore > b.length) break;
      pezzi.push(b.subarray(o, o + misuraSettore));
      letti += misuraSettore;
      if (limite > 0 && letti >= limite) break;
      s = fat[s] ?? 0xfffffffe;
    }
    const tutto = new Uint8Array(pezzi.reduce((n, p) => n + p.length, 0));
    let q = 0;
    for (const p of pezzi) {
      tutto.set(p, q);
      q += p.length;
    }
    return limite > 0 ? tutto.subarray(0, limite) : tutto;
  };

  //  ── LA DIRECTORY: si cerca la voce che si chiama «Workbook» ─────────────
  const dir = catena(dv.getUint32(48, true), 0);
  const dvd = new DataView(dir.buffer, dir.byteOffset, dir.byteLength);
  for (let i = 0; i + 128 <= dir.length; i += 128) {
    const lunNome = dvd.getUint16(i + 64, true);
    if (lunNome < 4) continue;
    //  I nomi sono in UTF-16LE e portano lo zero finale dentro la lunghezza.
    const nome = td("utf-16le").decode(dir.subarray(i, i + lunNome - 2));
    if (nome !== "Workbook" && nome !== "Book") continue;
    const misura = dvd.getUint32(i + 120, true);
    //  ⚠️ Sotto i 4096 byte starebbe nel mini-flusso, che qui non si legge:
    //   meglio dire «non ci sono riuscito» che consegnare byte sbagliati.
    if (misura < 4096) return null;
    return catena(dvd.getUint32(i + 116, true), misura);
  }
  return null;
}

/** Le stringhe della SST: BIFF8 le tiene tutte insieme, in un record che può
 *  continuare in altri record CONTINUE — e una stringa può essere spezzata a
 *  metà fra i due, cambiando pure codifica nel mezzo. È il punto in cui i
 *  lettori scritti in fretta sbagliano. */
function testoBiff(w: Uint8Array): string {
  const dv = new DataView(w.buffer, w.byteOffset, w.byteLength);
  const fuori: string[] = [];
  const sst: string[] = [];
  let p = 0;

  while (p + 4 <= w.length) {
    const tipo = dv.getUint16(p, true);
    const lun = dv.getUint16(p + 2, true);
    const corpo = p + 4;
    if (corpo + lun > w.length) break;

    if (tipo === 0x00fc) {
      //  SST — si concatena col seguito dei CONTINUE, poi si scorre.
      //  ⚠️ I pezzi restano SEPARATI: vedi la nota sopra `leggiSst`.
      const pezzi: Uint8Array[] = [w.subarray(corpo, corpo + lun)];
      let q = p + 4 + lun;
      while (q + 4 <= w.length && dv.getUint16(q, true) === 0x003c) {
        const l2 = dv.getUint16(q + 2, true);
        pezzi.push(w.subarray(q + 4, q + 4 + l2));
        q += 4 + l2;
      }
      sst.push(...leggiSst(pezzi));
      p = q;
      continue;
    }

    if (tipo === 0x00fd && lun >= 10) {
      //  LABELSST: la cella rimanda a una stringa della tabella.
      const i = dv.getUint32(corpo + 6, true);
      if (sst[i]) fuori.push(sst[i]);
    } else if (tipo === 0x0203 && lun >= 14) {
      fuori.push(numero(dv.getFloat64(corpo + 6, true)));
    } else if (tipo === 0x027e && lun >= 10) {
      fuori.push(numero(daRk(dv.getUint32(corpo + 6, true))));
    } else if (tipo === 0x00bd && lun >= 6) {
      //  MULRK: più celle numeriche di fila, ognuna 6 byte.
      for (let q = corpo + 4; q + 6 <= corpo + lun - 2; q += 6) {
        fuori.push(numero(daRk(dv.getUint32(q + 2, true))));
      }
    } else if (tipo === 0x0006 && lun >= 20) {
      //  FORMULA: se il risultato è un numero sta nei primi 8 byte del valore.
      //  ⚠️ Se i due byte finali sono 0xFFFF il risultato NON è un numero (è
      //   testo, o un errore): leggerlo come double darebbe una cifra inventata.
      if (dv.getUint16(corpo + 12, true) !== 0xffff) {
        fuori.push(numero(dv.getFloat64(corpo + 6, true)));
      }
    }
    p += 4 + lun;
  }
  return fuori.join("\n");
}

const numero = (n: number): string =>
  !Number.isFinite(n) ? "" : Number.isInteger(n) ? String(n) : String(Math.round(n * 1e6) / 1e6);

/** I numeri «RK»: interi o decimali compressi in quattro byte. */
function daRk(v: number): number {
  const centesimi = (v & 1) === 1;
  let n: number;
  if ((v & 2) === 2) {
    //  intero con segno su 30 bit
    n = v >> 2;
  } else {
    /*  I 30 bit alti di un double, il resto a zero.
        ⚠️ IL «true» IN FONDO NON È FACOLTATIVO, ed è costato una lettura
        intera: `setUint32` senza di lui scrive in BIG endian, mentre
        `getFloat64(0, true)` rilegge in little. I quattro byte finiscono
        girati, il numero letto è un decimale minuscolo, e l'arrotondamento lo
        stampa «0». Sul foglio del fornitore venivano zero TUTTE le quantità e
        tutti i prezzi, e il totale usciva −153,305: cifre plausibili a
        vedersi, e completamente inventate. */
    const b = new ArrayBuffer(8);
    new DataView(b).setUint32(4, v & 0xfffffffc, true);
    n = new DataView(b).getFloat64(0, true);
  }
  return centesimi ? n / 100 : n;
}

/** ── ⚠️ LA TABELLA DELLE STRINGHE È SPEZZATA, E QUI SI SBAGLIA ────────────
 *
 *  La SST non sta in un record solo: quando non ci sta, prosegue in record
 *  CONTINUE. E il taglio può cadere IN MEZZO A UNA PAROLA.
 *
 *  Il punto che frega chiunque: ogni CONTINUE comincia con UN BYTE che dice se
 *  il seguito di quella parola è scritto a un byte per lettera o a due — e può
 *  essere DIVERSO da come era cominciata. Chi incolla i pezzi e legge dritto si
 *  mangia quel byte come se fosse testo, e da lì in poi tutte le stringhe
 *  slittano di uno: prima escono con una lettera in più davanti, poi finiscono
 *  su lunghezze inventate e la lettura si ferma a metà.
 *  Era esattamente quello che succedeva: sul foglio del fornitore cinese si
 *  leggevano i primi due articoli e poi più niente.
 *
 *  Quindi qui i pezzi NON si incollano: si tengono separati e si legge
 *  attraversandoli, cambiando codifica quando si passa al pezzo dopo.
 *  ───────────────────────────────────────────────────────────────────────── */
function leggiSst(pezzi: Uint8Array[]): string[] {
  //  Dove siamo: quale pezzo, e a che punto dentro.
  let iP = 0;
  let p = 0;

  /** Vero se c'è ancora qualcosa da leggere, spostandosi al pezzo dopo. */
  const avanti = (): boolean => {
    while (iP < pezzi.length && p >= pezzi[iP].length) {
      iP++;
      p = 0;
      //  ⚠️ IL BYTE DELLA CODIFICA lo consuma chi sta leggendo una parola a
      //   cavallo (vedi `stringa`): qui NON si tocca, altrimenti lo si
      //   mangerebbe due volte.
    }
    return iP < pezzi.length;
  };

  const byte = (): number => {
    if (!avanti()) return -1;
    return pezzi[iP][p++];
  };
  const due = (): number => {
    const a = byte();
    const b = byte();
    return a < 0 || b < 0 ? -1 : a | (b << 8);
  };
  const quattro = (): number => {
    const a = due();
    const b = due();
    return a < 0 || b < 0 ? -1 : a | (b << 16);
  };

  /** Una stringa, attraversando i pezzi. */
  const stringa = (): string | null => {
    const car = due();
    if (car < 0) return null;
    const opzioni = byte();
    if (opzioni < 0) return null;
    let larga = (opzioni & 1) === 1;
    const conRich = (opzioni & 8) === 8;
    const conFar = (opzioni & 4) === 4;
    const nRich = conRich ? due() : 0;
    const nFar = conFar ? quattro() : 0;

    let testo = "";
    let restano = car;
    while (restano > 0) {
      if (!avanti()) return testo;
      const pezzo = pezzi[iP];
      //  Quante lettere ci stanno ancora in QUESTO pezzo.
      const disponibili = larga ? Math.floor((pezzo.length - p) / 2) : pezzo.length - p;
      const prendo = Math.min(restano, disponibili);
      if (prendo > 0) {
        const b = larga ? prendo * 2 : prendo;
        testo += larga
          ? td("utf-16le").decode(pezzo.subarray(p, p + b))
          : td("windows-1252").decode(pezzo.subarray(p, p + b));
        p += b;
        restano -= prendo;
      }
      if (restano > 0) {
        //  Si passa al pezzo dopo: il suo PRIMO byte dice come è scritto il
        //  seguito, e va consumato qui — è l'unico posto che sa di essere a
        //  cavallo fra due record.
        iP++;
        p = 0;
        if (iP >= pezzi.length) break;
        larga = (pezzi[iP][0] & 1) === 1;
        p = 1;
      }
    }
    //  Le code (formattazione ricca, estensioni asiatiche) si saltano, e
    //  possono anch'esse stare a cavallo.
    let daSaltare = nRich * 4 + nFar;
    while (daSaltare > 0 && avanti()) {
      const resta = pezzi[iP].length - p;
      const q = Math.min(daSaltare, resta);
      p += q;
      daSaltare -= q;
      if (daSaltare > 0) {
        iP++;
        p = 0;
        if (iP >= pezzi.length) break;
        p = 1;
      }
    }
    return testo;
  };

  //  L'intestazione della SST: due conteggi da quattro byte. Il secondo è
  //  quante stringhe distinte ci sono.
  quattro();
  const quante = quattro();
  const fuori: string[] = [];
  for (let i = 0; i < quante && i < 200000; i++) {
    const s = stringa();
    if (s == null) break;
    fuori.push(s);
  }
  return fuori;
}

/* ═══════════════════════════════════════════════════════════════════════════
   3. LA PORTA D'INGRESSO
   ═════════════════════════════════════════════════════════════════════════ */

export const eFoglioDiCalcolo = (nome: string, tipo?: string): boolean =>
  /\.(xls|xlsx|xlsm)$/i.test(nome) || /spreadsheet|excel|ms-excel/i.test(tipo ?? "");

/** Il testo di un foglio di calcolo, nella stessa forma che torna dai PDF. */
export async function leggiFoglio(dati: ArrayBuffer, nome: string): Promise<LetturaPdf> {
  try {
    const b = new Uint8Array(dati);
    //  Il tipo si decide dai BYTE, non dall'estensione: capita spessissimo che
    //  un .xlsx venga salvato con il nome .xls, e viceversa.
    const eZip = b[0] === 0x50 && b[1] === 0x4b;
    const testo = eZip
      ? await testoXlsx(dati)
      : (() => {
          const w = flussoWorkbook(dati);
          return w ? testoBiff(w) : "";
        })();

    if (!testo.trim()) {
      return {
        testo: "",
        ok: false,
        motivo: eZip
          ? "il foglio non contiene testo leggibile: i numeri si scrivono a mano."
          : "questo .xls non si è saputo aprire (formato vecchio o protetto): i numeri si scrivono a mano.",
      };
    }
    return { testo, ok: true, motivo: "" };
  } catch {
    return {
      testo: "",
      ok: false,
      motivo: `«${nome}» non si è potuto leggere: scrivi i numeri a mano.`,
    };
  }
}
