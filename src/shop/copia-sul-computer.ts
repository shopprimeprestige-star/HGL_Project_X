/** ── LA CONSULENZA INTERA SUL COMPUTER DI CHI REGISTRA ─────────────────────
 *
 *  Segnalazione del titolare (15/10/2026): «Meetly registra, ma solo 2 minuti
 *  e 31 mi ha scaricato. Voglio che mi scarica tutta la consulenza: appena
 *  termino il Meet».
 *
 *  ⚠️ LA CAUSA, MISURATA. Senza Drive la registrazione si spezza in parti da
 *   40 MB per stare sotto il tetto dell'archivio (vedi ritmo-registrazione).
 *   Con lo schermo condiviso, a ~2,2 Mbit/s, 40 MB sono ~150 secondi: i
 *   2 min 31 s erano UNA parte, l'ultima. Le precedenti erano già salite in
 *   archivio e buttate dalla memoria.
 *
 *  ⚠️ PERCHÉ NON SI UNISCONO LE PARTI. Ogni parte è un file a sé, con la sua
 *   intestazione (MP4 o WebM) e i tempi che ripartono da zero: attaccate una
 *   dietro l'altra i lettori si fermano alla prima. Unirle davvero vuol dire
 *   riscrivere le scatole del formato, diverse da browser a browser.
 *
 *  LA SCELTA. Una seconda registrazione sullo stesso flusso, «la copia per il
 *   computer», che non si taglia: stesso formato del file unico che già si fa
 *   con Drive. L'archivio non cambia. Queste regole decidono solo QUANDO la
 *   copia serve e QUALE file finisce nei Download; l'upload non lo toccano.
 *   Solo chi registra, mai il cliente.
 *  ───────────────────────────────────────────────────────────────────────── */
import { SOGLIA_MASSIMA } from "@/shop/ritmo-registrazione";

/** Chi ha prodotto il file: la registrazione per l'archivio o la copia. */
export type Fonte = "principale" | "copia";
/** Perché il file si è chiuso. `parte` = parte intermedia del principale. */
export type Motivo = "fine" | "tetto" | "guasto" | "scartata" | "parte";

/** La copia serve? Sì se il principale si taglia prima di 1,5 GB (niente
 *  Drive), o se una sua parte è già chiusa: allora il principale non è più
 *  la consulenza intera. */
export function serveLaCopia(p: { soglia: number; partiChiuse: number }): boolean {
  return p.soglia < SOGLIA_MASSIMA || p.partiChiuse > 0;
}

/** La copia arrivata a questo peso va chiusa, scaricata e riaperta? Il file
 *  vive nella memoria del browser: oltre 1,5 GB la scheda rischia di cadere. */
export function copiaPiena(peso: number): boolean {
  return peso >= SOGLIA_MASSIMA;
}

/** Alla chiusura di un file: si scarica sul computer? */
export function siScarica(p: {
  chi: Fonte;
  motivo: Motivo;
  copiaAccesa: boolean;
  peso: number;
  viewer: boolean;
}): boolean {
  if (p.viewer || !(p.peso > 0)) return false;
  if (p.chi === "copia") return p.motivo !== "scartata";
  //  Il principale si scarica solo quando la copia non c'è: con Drive (è già
  //  il file intero), in riserva (copia guasta) o con l'interruttore spento.
  return !p.copiaAccesa;
}

/** L'interruttore d'emergenza: `localStorage.hg_rec_copia = "0"` spegne la
 *  copia senza pubblicare niente, se un portatile soffrisse il doppio
 *  codificatore. Qualunque altro valore (o niente) la lascia accesa. */
export function copiaPermessa(valore: string | null | undefined): boolean {
  return valore !== "0";
}
