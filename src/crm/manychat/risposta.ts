/** ── LA ROTTA DELLE RISPOSTE: LA LOGICA ────────────────────────────────────
 *
 *  Commessa 2026-10-23 (WhatsApp con ManyChat). SCHELETRO del compito 1: ci
 *  sono solo i tipi e la firma. Questo file lo riempie in due tempi, in
 *  sequenza:
 *   - compito U2 (Dev C): le parti CONFERMA (`rispostaAlPromemoria` del 22/10),
 *     REGISTRO (`whatsapp_messages` deduplicato, `whatsapp_contacts`) e STOP
 *     (`non_scrivere_dal`);
 *   - compito 3 (Dev C): la parte SECONDO STATO (`contattoWa` e `risposta_il`
 *     dell'invio, via `dopoRisposta` di contatto.ts).
 *  Prove in `prove/manychat/risposta.mjs`.
 *
 *  La rotta (`api.public.manychat-risposta.ts`) legge il corpo con
 *  `leggiCorpoLimitato`, controlla `X-HGL-Token` con `stessaChiave`, poi chiama
 *  `gestisciRisposta`. A una richiesta autorizzata risponde sempre `{ok:true}`.
 *
 *  ⚠️ NON CHIAMA MAI MANYCHAT. Un messaggio da un numero sconosciuto (Default
 *   Reply, nessun invio abbinato) si registra solo se il telefono è già in
 *   `whatsapp_contacts` dell'installazione; altrimenti si ignora.
 *  ⚠️ Nei log solo codici: mai numero, nome, testo o `subscriber_id`.
 *  ───────────────────────────────────────────────────────────────────────── */
import type { CorpoRitorno } from "./ritorno";

/** Lo stato HTTP della rotta: 503 senza segreto sul server, 401 senza chiave
 *  giusta, 413 corpo oltre 8 KB, 200 per ogni richiesta autorizzata. */
export type StatoRisposta = 200 | 401 | 413 | 503;

export interface RichiestaRisposta {
  /** il confronto di `X-HGL-Token` con `MANYCHAT_RITORNO_TOKEN` è andato bene */
  chiaveOk: boolean;
  /** `MANYCHAT_RITORNO_TOKEN` esiste sul server */
  segretoPresente: boolean;
  /** il corpo letto e ripulito; `null` = illeggibile */
  corpo: CorpoRitorno | null;
  /** il corpo ha superato il limite di 8 KB */
  troppoGrande?: boolean;
  adesso: Date;
}

export interface EsitoRispostaRotta {
  stato: StatoRisposta;
  /** per i conteggi nei log: `confermato`, `stop`, `registrata`, `ignorata`… */
  esito?: string;
}

/** Le porte della rotta (database, `rispostaAlPromemoria`, avvisi). U2 le dettaglia. */
export interface PorteRisposta {
  avviso(messaggio: string): void;
}

export async function gestisciRisposta(
  _porte: PorteRisposta,
  _richiesta: RichiestaRisposta,
): Promise<EsitoRispostaRotta> {
  throw new Error("manychat/risposta: gestisciRisposta non è ancora scritta (compito U2)");
}
