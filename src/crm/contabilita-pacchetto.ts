/** ── IL PACCHETTO PER IL COMMERCIALISTA ────────────────────────────────────
 *
 *  Richiesta del committente: a fine periodo si scarica UN file, si allega a
 *  una mail e dentro c'è tutto — i documenti originali come sono arrivati, gli
 *  elenchi in un formato che si apre con un foglio di calcolo, e il riepilogo
 *  dei conti.
 *
 *  ── ⚠️ GLI ORIGINALI, NON LE NOSTRE COPIE ─────────────────────────────────
 *  Dentro va il file COM'È ARRIVATO: l'XML dello SDI, il PDF di Meta con la
 *  sua grafica. Non una nostra ristampa dei numeri che abbiamo letto. In una
 *  verifica il documento è quello del fornitore, e una ristampa — per quanto
 *  fedele — è una cosa che abbiamo scritto noi. Gli elenchi in CSV servono a
 *  leggere in fretta; a fare fede sono i file nella cartella `originali`.
 *
 *  ── ⚠️ UNO ZIP SCRITTO A MANO, E VA BENE COSÌ ─────────────────────────────
 *  Senza compressione (metodo 0, «stored»). Sembra una rinuncia e non lo è: un
 *  PDF e un JPEG sono già compressi, e ricomprimerli guadagna qualche punto
 *  percentuale in cambio di una libreria in più nel pacchetto che il browser
 *  scarica. Gli XML invece si comprimerebbero bene, ma pesano dei kilobyte.
 *  Lo ZIP «stored» è un formato di quaranta righe, lo apre qualunque cosa, e
 *  non c'è niente che possa sbagliarsi in silenzio.
 *  ⚠️ Niente ZIP64: sopra i 4 GB o le 65.535 voci questo formato non basta
 *   più. Un trimestre di fatture sta in qualche megabyte; se un giorno non ci
 *   stesse, il file uscirebbe rotto — quindi c'è un controllo che lo dice
 *   invece di produrre un archivio che non si apre.
 *  ───────────────────────────────────────────────────────────────────────── */

interface Voce {
  nome: string;
  dati: Uint8Array;
  /** Data del file dentro l'archivio: quella del documento, così l'ordine per
   *  data in una cartella scaricata dice qualcosa. */
  quando: Date;
}

/* ── CRC32, che lo ZIP pretende per ogni file ─────────────────────────────── */
const TABELLA = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(dati: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < dati.length; i++) c = TABELLA[(c ^ dati[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** La data come la scrive il DOS, che è il formato che lo ZIP porta dal 1989.
 *  ⚠️ Gli anni partono dal 1980 e i secondi vanno a due a due: una data prima
 *   del 1980 non si può scrivere, e si riporta al 1980 invece di produrre un
 *   numero negativo che i programmi di decompressione mostrano come 2107. */
function dataDos(d: Date): { ora: number; data: number } {
  const anno = Math.max(1980, d.getFullYear());
  return {
    ora: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    data: ((anno - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

const testoInByte = (s: string): Uint8Array => new TextEncoder().encode(s);

export function componiZip(voci: Voce[]): Blob {
  if (voci.length > 65_535) {
    throw new Error("troppi file per un archivio ZIP semplice: dividi il periodo in due");
  }
  const pezzi: Uint8Array[] = [];
  const centrale: Uint8Array[] = [];
  let posizione = 0;

  for (const v of voci) {
    const nome = testoInByte(v.nome);
    const crc = crc32(v.dati);
    const { ora, data } = dataDos(v.quando);

    //  L'intestazione locale: 30 byte fissi, poi il nome, poi i dati.
    const testa = new DataView(new ArrayBuffer(30));
    testa.setUint32(0, 0x04034b50, true);
    testa.setUint16(4, 20, true); // versione minima
    testa.setUint16(6, 0x0800, true); // il nome è in UTF-8
    testa.setUint16(8, 0, true); // metodo 0: nessuna compressione
    testa.setUint16(10, ora, true);
    testa.setUint16(12, data, true);
    testa.setUint32(14, crc, true);
    testa.setUint32(18, v.dati.length, true);
    testa.setUint32(22, v.dati.length, true);
    testa.setUint16(26, nome.length, true);
    testa.setUint16(28, 0, true);
    pezzi.push(new Uint8Array(testa.buffer), nome, v.dati);

    //  La voce dell'indice, in fondo: 46 byte fissi, poi il nome.
    const indice = new DataView(new ArrayBuffer(46));
    indice.setUint32(0, 0x02014b50, true);
    indice.setUint16(4, 20, true);
    indice.setUint16(6, 20, true);
    indice.setUint16(8, 0x0800, true);
    indice.setUint16(10, 0, true);
    indice.setUint16(12, ora, true);
    indice.setUint16(14, data, true);
    indice.setUint32(16, crc, true);
    indice.setUint32(20, v.dati.length, true);
    indice.setUint32(24, v.dati.length, true);
    indice.setUint16(28, nome.length, true);
    indice.setUint32(42, posizione, true);
    centrale.push(new Uint8Array(indice.buffer), nome);

    posizione += 30 + nome.length + v.dati.length;
  }

  const misuraIndice = centrale.reduce((s, p) => s + p.length, 0);
  const coda = new DataView(new ArrayBuffer(22));
  coda.setUint32(0, 0x06054b50, true);
  coda.setUint16(8, voci.length, true);
  coda.setUint16(10, voci.length, true);
  coda.setUint32(12, misuraIndice, true);
  coda.setUint32(16, posizione, true);

  return new Blob([...pezzi, ...centrale, new Uint8Array(coda.buffer)] as BlobPart[], {
    type: "application/zip",
  });
}

/** ── ⚠️ DUE FATTURE CON LO STESSO NOME DI FILE ────────────────────────────
 *  Succede sempre: Meta chiama i suoi PDF `invoice.pdf` tutti i mesi. Due voci
 *  con lo stesso nome dentro uno ZIP si aprono, ma la seconda sovrascrive la
 *  prima quando si estrae — e nella cartella del commercialista manca una
 *  fattura, senza che nessuno se ne accorga. */
export function nomeLibero(usati: Set<string>, proposto: string): string {
  /*  ── ⚠️ LE BARRE SI TENGONO, IL RESTO NO ──────────────────────────────
      Dentro uno ZIP la barra È la cartella: toglierla come «carattere non
      ammesso» faceva finire tutto alla rinfusa nella radice, con nomi tipo
      `originali-fattura.pdf`. Si ripulisce quindi ogni PEZZO del percorso,
      non la stringa intera.
      ── ⚠️ E VIA GLI ACCENTI. Il formato prevede da vent'anni una spunta per
       dire «questo nome è in UTF-8», e la si scrive; ma i programmi di
       decompressione più vecchi la ignorano, e `Amazon EU S.à r.l.pdf`
       arriva sul computer del commercialista con dei geroglifici al posto
       della à. Un nome senza accenti si legge dappertutto, e quello che si
       perde è una lettera in un nome di file: il documento dentro è intatto. */
  const segmento = (x: string) =>
    x
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\x20-\x7e]/g, "")
      .replace(/[\\:*?"<>|]/g, "-")
      .replace(/\s+/g, " ")
      .trim();
  const pulito =
    proposto.split("/").map(segmento).filter(Boolean).join("/").slice(0, 120) || "documento";
  if (!usati.has(pulito)) {
    usati.add(pulito);
    return pulito;
  }
  const punto = pulito.lastIndexOf(".");
  const radice = punto > 0 ? pulito.slice(0, punto) : pulito;
  const coda = punto > 0 ? pulito.slice(punto) : "";
  for (let i = 2; i < 1000; i++) {
    const tentativo = `${radice} (${i})${coda}`;
    if (!usati.has(tentativo)) {
      usati.add(tentativo);
      return tentativo;
    }
  }
  usati.add(pulito);
  return pulito;
}

/** Da base64 ai byte veri. */
export function daBase64(b64: string): Uint8Array {
  const grezzo = atob(String(b64 ?? "").replace(/^data:[^,]*,/, ""));
  const b = new Uint8Array(grezzo.length);
  for (let i = 0; i < grezzo.length; i++) b[i] = grezzo.charCodeAt(i);
  return b;
}

/** ── IL CSV, PER CHI LO APRE CON EXCEL IN ITALIA ──────────────────────────
 *  ⚠️ IL PUNTO E VIRGOLA, non la virgola: su un computer configurato in
 *   italiano Excel separa le colonne con il punto e virgola, e un file
 *   separato da virgole si apre tutto ammucchiato in una colonna sola.
 *  ⚠️ E I NUMERI CON LA VIRGOLA DECIMALE, per lo stesso motivo: 1234.56
 *   diventerebbe testo, e la somma in fondo non si potrebbe fare.
 *  ⚠️ Con il BOM davanti, o le lettere accentate diventano dei geroglifici. */
export function csv(righe: (string | number)[][]): string {
  const cella = (v: string | number): string => {
    if (typeof v === "number") {
      return Number.isFinite(v) ? v.toFixed(2).replace(".", ",") : "";
    }
    const s = String(v ?? "");
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + righe.map((r) => r.map(cella).join(";")).join("\r\n") + "\r\n";
}
