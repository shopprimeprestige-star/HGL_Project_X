/** ── IL CONTRATTO DELL'IMPORT DEI PRODOTTI (EDITOR PRODOTTI · E2b) ─────────
 *  Commessa 2026-11-25-editor-prodotti, PIANO §1.4. Solo tipi e misure: niente codice che fa qualcosa.
 *  Browser (anteprima, E10) e server (E3) parlano di prodotti GIÀ NORMALIZZATI, non di righe di CSV: da qui si importano i tipi
 *  (mai da `client.ts`). Le regole che li controllano sono in `import-regole.ts`, le stesse nel browser e nel server. */

/** Una variante come la scrive il lettore del file. `prezzoCent`, `pesoG`, `gtin`, `costoCent` a `null` = «vale quello del prodotto» / non c'è. */
export interface VarianteImport {
  /** Numero di riga come lo vede Excel (l'intestazione è la riga 1): serve a dire DOVE sta un errore. */
  riga: number;
  sku: string;
  nome: string;
  opzioni: Record<string, string>;
  prezzoCent: number | null;
  pesoG: number | null;
  gtin: string | null;
  costoCent: number | null;
  /** Solo tramite il movimento «carico» registrato dal server: mai scritta direttamente. */
  giacenza: number;
}

/** Il prodotto da importare. Lo stato non c'è: entra SEMPRE in bozza, lo scrive la funzione del database. */
export interface ProdottoImport {
  handle: string;
  titolo: string;
  tipo: "patch" | "cura" | "kit";
  marca?: string;
  descrizioneBreve?: string;
  descrizioneLunga?: string;
  categoriaGoogle?: string;
  fornitore?: string;
  seoTitolo?: string;
  seoDescrizione?: string;
  /** Gli indirizzi (slug) delle categorie che ESISTONO: il server li risolve in id. */
  categorie: string[];
  sku: string;
  prezzoCent: number;
  pesoG?: number;
  gtin?: string;
  varianti: VarianteImport[];
}

export interface ErroreRiga {
  riga: number;
  handle?: string;
  /** La frase per una persona, senza «Riga N»: la riga è nel campo `riga` (`descriviErrore` le mette insieme). */
  frase: string;
  /** Tutte le righe del prodotto respinto: «Scarica le righe da correggere» le rimette insieme. */
  righeProdotto?: number[];
}
export interface AvvisoRiga {
  /** 0 = riguarda tutto il file. */
  riga: number;
  handle?: string;
  frase: string;
}

/** Richiesta e risposta dell'anteprima: sola lettura, NESSUNA scrittura. */
export interface RichiestaVerifica {
  slugs: string[];
  skus: string[];
}
export interface RispostaVerifica {
  presenti: { id: string; slug: string; nome: string; stato: string }[];
  skuUsati: { sku: string; prodottoId: string; prodottoNome: string; comeVariante: boolean }[];
  categorie: { id: string; slug: string; nome: string }[];
  costoDisponibile: boolean;
  importaDisponibile: boolean;
}

/** Richiesta e risposta dell'import vero: fino a 5 prodotti per volta. */
export interface RichiestaImporta {
  prodotti: ProdottoImport[];
}
export interface RisultatoImporta {
  handle: string;
  /** «aggiornato»: c'era già (stesso indirizzo) e il file l'ha sovrascritto. «gia_presente»: c'era e non si è potuto sovrascrivere
   *  (database senza `shop_import_sovrascrivi`): saltato come prima. */
  esito: "creato" | "aggiornato" | "gia_presente" | "errore";
  prodottoId?: string;
  errori?: ErroreRiga[];
  avvisi?: AvvisoRiga[];
}
export interface RispostaImporta {
  risultati: RisultatoImporta[];
}

/** Le misure dell'import (SPEC §6.6 e PIANO §1.1). Il database rifiuta oltre gli stessi tetti. */
export const LIMITI = {
  /** Solo del browser: il server è senza stato. */
  prodottiPerFile: 300,
  prodottiPerRichiesta: 5,
  variantiPerProdotto: 250,
  categorieSuProdotto: 10,
  /** Il server accetta fino a 200 000 byte; il client si ferma a 160 000 (un kit da 250 varianti ne pesa circa 81 000). */
  byteServer: 200_000,
  byteClient: 160_000,
  nome: 120,
  descrizioneBreve: 300,
  descrizioneLunga: 5000,
  marca: 80,
  fornitore: 200,
  gtin: 20,
  categoriaGoogle: 200,
  seoTitolo: 300,
  seoDescrizione: 500,
  nomeOpzione: 40,
  peso: 1_000_000,
  giacenza: 1_000_000,
} as const;
