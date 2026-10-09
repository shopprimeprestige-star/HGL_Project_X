/** ── LO STATO DELLA STANZA, CHIESTO UNA VOLTA SOLA PER TUTTI ───────────────
 *
 *  Che pagina guarda il consulente, se questo cliente ha il suo preventivo
 *  acceso, e la regia del gruppo: tre cose che il server legge nella stessa
 *  riga e che adesso arrivano con UNA domanda sola (api.presenter.curpage).
 *
 *  ⚠️ PERCHÉ ESISTE, E NON È UN VEZZO. Il 27/09/2026 il sito si è fermato con
 *   «Error 1027 — hai raggiunto i limiti del piano»: è il tetto giornaliero di
 *   richieste di Cloudflare Workers. Misurato in laboratorio subito dopo: UNA
 *   sola scheda cliente faceva 7.200 richieste l'ora, quasi tutte di tre giri
 *   separati che chiedevano al server cose lette dalle stesse righe — la
 *   pagina ogni 1,2 s, la regia ogni 2 s dal motore, la regia ogni 3 s dalla
 *   pagina del preventivo. Con due o tre consulenze aperte il tetto di
 *   100.000 al giorno si brucia in una giornata di lavoro — e prima di
 *   fermarsi, tutto diventa lentissimo.
 *
 *  ⚠️ STA IN UN FILE SUO per lo stesso motivo meccanico di
 *   `shop/mio-preventivo`: lo riempie shop/call e lo leggono shop/live e
 *   shop/regia-gruppo, che shop/call importa già. Metterlo dentro uno dei due
 *   chiuderebbe un anello fra i moduli.
 *  ───────────────────────────────────────────────────────────────────────── */
import type { RegiaGruppo } from "@/shop/preventivi-di-gruppo";

export type StatoStanza = {
  code: string;
  /** La pagina che questo cliente deve guardare ("" = non si sa). */
  path: string;
  /** Il server dice che deve restare sul proprio preventivo. */
  suo: boolean;
  regia: RegiaGruppo | null;
  gruppo: boolean;
};

let stato: StatoStanza | null = null;
const ascolti = new Set<(s: StatoStanza) => void>();

/** Lo stato letto per ultimo, se è di questa stanza. */
export function statoStanzaOra(code: string | null | undefined): StatoStanza | null {
  const c = String(code || "").trim();
  return stato && stato.code === c ? stato : null;
}

/** Ascolta lo stato della stanza. Chi ascolta NON chiede niente al server per
 *  conto suo: è tutto qui dentro. Torna la funzione per smettere. */
export function ascoltaStatoStanza(fn: (s: StatoStanza) => void): () => void {
  ascolti.add(fn);
  if (stato) { try { fn(stato); } catch { /* */ } }
  return () => { ascolti.delete(fn); };
}

/** Lo riempie il motore della consulenza (shop/call), che è l'unico che chiede. */
export function pubblicaStatoStanza(s: StatoStanza) {
  stato = s;
  for (const f of [...ascolti]) { try { f(s); } catch { /* un ascoltatore rotto non ferma gli altri */ } }
}

/** Cambiando stanza non si eredita lo stato di quella di prima. */
export function dimenticaStatoStanza() { stato = null; }
