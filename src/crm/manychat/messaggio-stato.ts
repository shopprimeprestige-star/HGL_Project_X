/** ── IL MESSAGGIO DELLO STATO LO SCRIVE IL CONSULENTE ──────────────────────────
 *
 *  Commessa 2026-10-30-messaggio-per-stato. Richiesta del titolare: «quando metto lo stato
 *  posso scrivere io che messaggio deve mandare in automatico nel promemoria, se è nell'arco
 *  delle 24 ore. Se è oltre le 24 ore posso scegliere se inviare il template dello stato,
 *  oppure un template generico (ciao, buongiorno, come va, sono Filippo, ti scrivo per sapere
 *  come eravamo rimasti)». Le prove stanno in `prove/manychat/messaggio-stato.mjs`.
 *
 *  La scelta sta NELLA SCHEDA (JSON, nessuna migrazione): `data.messaggioStato`. Vale SOLO per
 *  lo stato in cui è stata scritta: se `messaggioStato.stato` non è lo stato attuale, non si
 *  usa. In più `conStatoDal` (stato-dal.ts) la toglie al cambio di stato, così A → B → A non
 *  la fa rivivere.
 *
 *  Modulo PURO: il giro e la porta (giro.ts, porta.ts) e l'interfaccia lo usano, nessuno ne
 *  fa una copia. Campo vuoto / non toccato = tutto come prima della commessa.
 *  ───────────────────────────────────────────────────────────────────────── */
import type { LeadData } from "../types";
import { TABELLA_STATI } from "./stati";

/** Il modello generico, buono per tutti gli stati: v1 il nome, v2 il consulente (gli stessi
 *  campi del ricontatto, `campiRicontatto`). Il suo flusso in ManyChat si collega a parte. */
export const MODELLO_GENERICO = "hgl_come_eravamo_rimasti";

/** Cosa mandare se il cliente non scrive da più di 24 ore: il modello dello stato (di serie)
 *  o il generico. */
export type FuoriFinestra = "stato" | "generico";

export interface MessaggioStato {
  /** lo stato per cui è stato scritto: se la scheda ha cambiato stato, non vale più */
  stato: string;
  /** il testo libero (parte se il cliente ha scritto nelle ultime 24 ore); può essere vuoto */
  testo: string;
  fuoriFinestra: FuoriFinestra;
  /** quando è stato scritto (ISO) */
  scrittoIl: string;
}

/** Quanto può essere lungo il testo del consulente. Il limite di WhatsApp è 4096: qui il
 *  messaggio è un promemoria, non una lettera. */
export const MAX_TESTO_MESSAGGIO = 1000;

/** Lo stato ha un messaggio automatico? (la stessa tabella del giro: nessuna seconda lista) */
export const statoHaMessaggio = (stato: unknown): boolean =>
  typeof stato === "string" && Object.prototype.hasOwnProperty.call(TABELLA_STATI, stato);

/** Il messaggio della scheda, se vale per lo stato attuale e fa qualcosa: altrimenti `null`
 *  (= tutto come oggi). Non lancia mai: la scheda è un JSON che può avere qualunque forma. */
export function leggiMessaggioStato(
  d: Partial<LeadData> | null | undefined,
  statoAttuale: unknown = d?.stato,
): MessaggioStato | null {
  const m = d?.messaggioStato as unknown;
  if (!m || typeof m !== "object" || Array.isArray(m)) return null;
  const x = m as Record<string, unknown>;
  if (typeof statoAttuale !== "string" || x.stato !== statoAttuale) return null;
  if (!statoHaMessaggio(statoAttuale)) return null;
  if (x.testo !== undefined && typeof x.testo !== "string") return null;
  const testo = String(x.testo ?? "")
    .trim()
    .slice(0, MAX_TESTO_MESSAGGIO);
  const fuoriFinestra: FuoriFinestra = x.fuoriFinestra === "generico" ? "generico" : "stato";
  //  Né testo né scelta: non cambia niente.
  if (!testo && fuoriFinestra === "stato") return null;
  return {
    stato: statoAttuale,
    testo,
    fuoriFinestra,
    scrittoIl: typeof x.scrittoIl === "string" ? x.scrittoIl : "",
  };
}

/** Il testo con `{nome}` (maiuscole indifferenti) sostituito dal nome. `null` se il testo è
 *  vuoto, o se chiede il nome e non c'è: mai un «{nome}» al cliente. */
export function testoConNome(testo: string, nome: string): string | null {
  const t = String(testo ?? "").trim();
  if (!t) return null;
  const n = String(nome ?? "").trim();
  if (/\{nome\}/i.test(t) && !n) return null;
  //  Funzione, non stringa: un nome con «$&» o «$1» non deve diventare una sostituzione.
  return t.replace(/\{nome\}/gi, () => n);
}

/** Cosa fa partire il giro per questa scheda, secondo la finestra delle 24 ore.
 *  · `testoLibero`: il testo del consulente, già col nome; solo con la finestra aperta;
 *  · `generico`: il modello (fuori finestra, o di riserva se il testo viene rifiutato) è il
 *    generico invece di quello dello stato; solo se la scelta è «generico» E il suo flusso è
 *    collegato in ManyChat (altrimenti si usa il modello dello stato: mai niente che non parte).
 *    Con la finestra aperta e SENZA testo del consulente il generico non serve: la scelta vale
 *    «se sono passate più di 24 ore», e dentro le 24 ore si resta com'era (modello dello stato,
 *    che la porta manda come testo). */
export function sceltaInvio(
  m: MessaggioStato | null,
  o: { finestraAperta: boolean; flussoGenericoCollegato: boolean; nome: string },
): { generico: boolean; testoLibero: string | null } {
  if (!m) return { generico: false, testoLibero: null };
  const testo = o.finestraAperta ? testoConNome(m.testo, o.nome) : null;
  return {
    generico:
      m.fuoriFinestra === "generico" &&
      o.flussoGenericoCollegato &&
      (!o.finestraAperta || testo !== null),
    testoLibero: testo,
  };
}

/** Cosa scrivere nella scheda dopo la finestra. `undefined` = non scrivere niente (la chiave
 *  sparisce): campo vuoto e «modello dello stato» = come oggi. */
export function messaggioPerSalvare(
  stato: unknown,
  testo: string,
  fuoriFinestra: FuoriFinestra,
  adesso: Date,
): MessaggioStato | undefined {
  if (typeof stato !== "string" || !statoHaMessaggio(stato)) return undefined;
  const pulito = String(testo ?? "")
    .trim()
    .slice(0, MAX_TESTO_MESSAGGIO);
  if (!pulito && fuoriFinestra !== "generico") return undefined;
  return { stato, testo: pulito, fuoriFinestra, scrittoIl: adesso.toISOString() };
}

/** Cosa ha fatto il riquadro nella finestra: `null` = mai toccato; `{ valore }` = toccato, con il
 *  messaggio da salvare (`undefined` = l'utente lo ha svuotato apposta). */
export type BozzaMessaggio = { valore: MessaggioStato | undefined } | null;

/** La parte di patch col messaggio. Se il riquadro non è stato toccato NON c'è nessuna chiave:
 *  `{...scheda, ...patch}` (updateLead) lascerebbe altrimenti `undefined` al posto del messaggio
 *  già salvato, cancellandolo in silenzio. Per cancellarlo bisogna farlo apposta (testo vuoto e
 *  «modello dello stato»). Gli stati senza messaggio non hanno mai la chiave. */
export function patchMessaggio(
  stato: unknown,
  bozza: BozzaMessaggio,
): { messaggioStato?: MessaggioStato } {
  if (!bozza || !statoHaMessaggio(stato)) return {};
  return { messaggioStato: bozza.valore };
}
