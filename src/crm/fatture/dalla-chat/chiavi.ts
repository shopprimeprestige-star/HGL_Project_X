/** ── FATTURE DALLA CHAT · LE CHIAVI E LE COSTANTI ───────────────────────────
 *  Commessa 2026-11-13-fatture-dalla-chat (PIANO §2, T0). Qui sta, in un posto
 *  solo, DOVE il caricamento «dalla chat» scrive in `app_config` e i numeri che
 *  ne regolano i limiti. Niente rete, niente Supabase: solo stringhe e costanti
 *  — stesso ruolo di `bulk/chiavi.ts`, famiglia diversa.
 *
 *  ── ⚠️ NESSUNA CHIAVE INIZIA CON «fattura» ───────────────────────────────
 *  La numerazione delle fatture legge `fattura:` e le bozze `fattura_bozza:`
 *  (archivio.ts, `leggiPrefisso`). Una chiave nostra che vi rientrasse finirebbe
 *  nell'elenco delle emesse e sfalserebbe il prossimo numero. Per questo tutte
 *  le famiglie iniziano per `chat_fatture_` (mai `bulk_fatture_`: quella
 *  famiglia è il modello a file-indice-0..599 della bulk pura, non si mescola)
 *  — e la prova (prove/fatture-dalla-chat/fondamenta.mjs) lo verifica, con e
 *  senza la protezione di «_» nel LIKE.
 *
 *    chat_fatture_t:<lotto>            testata (stesso tipo TestataLotto della bulk)
 *    chat_fatture_r:<lotto>:<idRiga>   la riga: scheda, stato, modifiche, conferme, emessa, E la lettura della chat
 *    chat_fatture_p:<lotto>:<idRiga>   il file del bonifico di quella riga (percorso bucket, impronta, lettura, stato)
 *    chat_fatture_c:<lotto>:<idRiga>   reclamo di lettura (chat o bonifico) di quella riga, con scadenza
 *    chat_fatture_e:<lotto>            emittente del lotto (stesso schema di bulk_fatture_e)
 *
 *  `idRiga` qui è l'id della scheda (UUID di `crm_leads`), NON un indice-di-file
 *  a 4 cifre come nella bulk: ogni cliente è noto da subito e la scheda lo
 *  identifica meglio di qualunque indice. Per questo si valida in formato UUID
 *  — `idRigaValido`/`schedaIdValido`, stessa disciplina di `lottoValido` nella
 *  bulk — PRIMA di costruire o fare `LIKE` su qualunque chiave: arriva dal
 *  browser (revisione del revisore, punto 4).
 *
 *  Il lucchetto di emissione globale NON è nuovo: si importa `CHIAVE_LUCCHETTO`
 *  già esportata da `bulk/chiavi.ts` (una sola emissione per volta in tutto il
 *  CRM, bulk o chat che sia — PIANO §0.2). Non se ne definisce un secondo qui. */
import { lottoValido } from "../bulk/chiavi";

export const PREFISSO_TESTATA = "chat_fatture_t:";
const PREFISSO_RIGHE = "chat_fatture_r:";
const PREFISSO_PAGAMENTO = "chat_fatture_p:";
const PREFISSO_RECLAMI = "chat_fatture_c:";
const PREFISSO_EMITTENTE = "chat_fatture_e:";

/** ── LE COSTANTI DEL PIANO (§2) ───────────────────────────────────────── */
/** Clienti al massimo in un caricamento «dalla chat» (passo 1, SPEC §3). */
export const MAX_CLIENTI = 100;
/** Immagini di chat lette insieme in 1 sola chiamata AI, per cliente (SPEC §5). */
export const MAX_IMMAGINI_CHAT = 8;
/** Messaggi in entrata letti al massimo, i più recenti (SPEC §5). */
export const MAX_MESSAGGI_TESTO = 300;
/** Caratteri di testo al massimo mandati all'AI, tenendo i più recenti (SPEC §5). */
export const MAX_CARATTERI_TESTO = 6000;

/** L'id di una scheda (`crm_leads.id`) finisce dentro una chiave: un UUID, nient'altro.
 *  Si controlla PRIMA di costruire qualsiasi chiave, perché arriva dal browser. */
const FORMA_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const schedaIdValido = (id: string): boolean => FORMA_UUID.test(id);
/** `idRiga` = l'id della scheda scelta (PIANO §0.2): stesso formato, stesso controllo. */
export const idRigaValido = (idRiga: string): boolean => FORMA_UUID.test(idRiga);

function sicuroLotto(lotto: string): string {
  if (!lottoValido(lotto)) throw new Error("id del lotto non valido");
  return lotto;
}
function sicuroIdRiga(idRiga: string): string {
  if (!idRigaValido(idRiga)) throw new Error("id della riga non valido");
  return idRiga;
}

export const chiaveTestata = (lotto: string) => `${PREFISSO_TESTATA}${sicuroLotto(lotto)}`;
export const chiaveRiga = (lotto: string, idRiga: string) =>
  `${prefissoRighe(lotto)}${sicuroIdRiga(idRiga)}`;
export const chiavePagamento = (lotto: string, idRiga: string) =>
  `${prefissoPagamento(lotto)}${sicuroIdRiga(idRiga)}`;
export const chiaveReclamo = (lotto: string, idRiga: string) =>
  `${prefissoReclami(lotto)}${sicuroIdRiga(idRiga)}`;
export const chiaveEmittente = (lotto: string) => `${PREFISSO_EMITTENTE}${sicuroLotto(lotto)}`;

/** I prefissi con i «:» finali (un lotto non pesca quelli di un altro che inizia uguale).
 *  Per cancellare o leggere una famiglia intera: il LIKE va protetto come in `leggiPrefisso`. */
export const prefissoRighe = (lotto: string) => `${PREFISSO_RIGHE}${sicuroLotto(lotto)}:`;
export const prefissoPagamento = (lotto: string) => `${PREFISSO_PAGAMENTO}${sicuroLotto(lotto)}:`;
export const prefissoReclami = (lotto: string) => `${PREFISSO_RECLAMI}${sicuroLotto(lotto)}:`;

/** La cartella del bucket `dati-fattura` per il bonifico di un lotto: `<utente>/chat/<lotto>/`
 *  (nessun nome di persona nel percorso, stesso principio di `cartellaBucket` nella bulk). */
export const cartellaBucket = (userId: string, lotto: string) =>
  `${userId}/chat/${sicuroLotto(lotto)}/`;
