/** ── FATTURE BULK · IL MAGAZZINO DELLA ROTTA (bulk.server.ts) ──
 *  SEGNAPOSTO di T0: i tipi e le firme ci sono, i corpi lanciano «da fare».
 *  Lo riempie T9 (dopo T1 e T7). Tutte le azioni tranne `emetti-riga` (che sta in
 *  emissione.server.ts). Le azioni prendono PORTE (archivio, bucket, AI, orologio),
 *  così si provano con finti; il client Supabase vero si crea solo nella rotta.
 *  ⚠️ Deve restare importabile senza ambiente: niente lettura di `process.env` né
 *  client creato a livello di modulo, o si rompe il bundle di tutte le prove. */
import type { ArchivioProtetto } from "./emissione-bulk";
import type { DettaglioLotto, RichiestaBulk, RispostaBulk, SintesiLotto } from "./tipi";

const daFare = (compito: string): never => {
  throw new Error(`da fare (${compito})`);
};

export interface PorteBulk {
  archivio: ArchivioProtetto;
  bucket: {
    carica: (percorso: string, dataUrl: string) => Promise<string | null>;
    scarica: (percorso: string) => Promise<string | null>;
    elenca: (cartella: string) => Promise<string[]>;
    rimuovi: (percorsi: string[]) => Promise<string | null>;
    firma: (percorso: string, secondi: number) => Promise<string | null>;
  };
  /** Un solo tentativo, con scadenza; risponde con il testo e il motivo di fine. */
  ai: (immagini: string[], timeoutMs: number) => Promise<{ testo: string; fine: string } | { errore: string }>;
  adesso: () => number;
  /** Utente che chiama (per i percorsi del bucket). */
  utente: string;
}

export function elencoLotti(porte: PorteBulk): Promise<SintesiLotto[]> {
  return daFare("T9 elencoLotti");
}

export function dettaglioLotto(porte: PorteBulk, lotto: string): Promise<DettaglioLotto | null> {
  return daFare("T9 dettaglioLotto");
}

export function urlMiniature(porte: PorteBulk, lotto: string, indici: number[]): Promise<Record<string, string>> {
  return daFare("T9 urlMiniature");
}

/** Smista le azioni POST (tranne `emetti-riga`). */
export function eseguiAzione(porte: PorteBulk, richiesta: RichiestaBulk): Promise<RispostaBulk> {
  return daFare("T9 eseguiAzione");
}
