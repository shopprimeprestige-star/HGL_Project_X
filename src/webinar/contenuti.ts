/** ── LO STATO DEI CONTENUTI, PER LA SALA ────────────────────────────────────
 *
 *  In modalità «Contenuti» gli spettatori vedono la pagina che stai mostrando.
 *  Ma vedere «la pagina delle slide» non basta: devono vedere LA SLIDE, quella
 *  su cui sei adesso. Senza, il webinar mostra a tutti la slide 1 mentre tu
 *  parli della 6 — e nessuno te lo dice, perché dall'altra parte sembra
 *  semplicemente che tu stia parlando di cose non collegate a quello che si
 *  vede.
 *
 *  ── PERCHÉ NON SI RIUSA IL CANALE DELLA CONSULENZA ────────────────────────
 *  Le slide seguono il presentatore su un canale in tempo reale, che a due
 *  persone è perfetto. A cinquecento è lo stesso muro per cui il video non
 *  poteva restare in mesh: ogni cambio di slide diventerebbe cinquecento
 *  consegne, e il tetto del piano si esaurisce in un pomeriggio.
 *  Qui lo stato viaggia con lo stato della sala — HTTP, con una cache di
 *  pochi secondi — che è la stessa strada di `curpage` e `quotestate`, cioè
 *  quella che già regge la navigazione e il preventivo.
 *
 *  ⚠️ IL PREZZO È IL RITARDO: la sala vede la slide nuova con qualche secondo
 *   di scarto. È accettabile perché una slide si commenta per un minuto, non
 *   per due secondi — e in cambio la vedono tutti invece di nessuno.
 */

/** Quello che il presentatore manda: l'ultimo valore di ogni evento, non la
 *  cronologia. Chi arriva a metà deve trovare lo stato ADESSO, non doverselo
 *  ricostruire da una sequenza che ha perso. */
export type StatoContenuti = Record<string, unknown>;

let inCoda: StatoContenuti = {};
let orologio: ReturnType<typeof setTimeout> | null = null;
let codiceSala = "";

/** Da chiamare quando la sala è in onda e in modalità contenuti; con stringa
 *  vuota si smette. Lo sa solo la console del webinar, ed è lei a dirlo. */
export function salaDeiContenuti(codice: string): void {
  codiceSala = codice;
  if (!codice) { inCoda = {}; if (orologio) { clearTimeout(orologio); orologio = null; } }
}

/** Registra un cambiamento. Non parte subito.
 *
 *  ⚠️ SI ACCUMULA E SI MANDA A PACCHETTI. Scorrendo le slide col dito o
 *   trascinando il cursore di una foto, gli eventi sono decine al secondo:
 *   uno per ciascuno sarebbe un attacco al proprio server. Si tiene l'ULTIMO
 *   valore di ogni tipo e si spedisce ogni mezzo secondo — che è comunque più
 *   veloce di quanto la sala possa leggere, visto che la sua risposta sta in
 *   cache per qualche secondo. */
export function pubblicaContenuti(evento: string, payload: unknown): void {
  if (!codiceSala) return;
  inCoda[evento] = payload;
  if (orologio) return;
  orologio = setTimeout(() => {
    orologio = null;
    const stato = inCoda;
    inCoda = {};
    if (!codiceSala || !Object.keys(stato).length) return;
    /** ── ⚠️ UNO STATO SOLO, PER TUTTA LA SALA ────────────────────────────
     *  Per un momento questo posto ha spedito uno stato PER CLASSE di schermo:
     *  computer, tablet e telefono ciascuno col suo. Sulla carta era più
     *  preciso; alla prova dei fatti obbligava chi conduce a guidare tre
     *  cornici insieme — e chi non lo faceva lasciava fermi i telefoni, cioè
     *  quasi tutta la sala.
     *  La regola giusta è più semplice: si sceglie SU QUALE schermata lavorare
     *  (vedi le tre schermate della regia) e quello che si fa lì arriva a
     *  tutti, ciascuno impaginato per il proprio schermo. */
    void fetch("/api/crm/webinar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ azione: "contenuti", codice: codiceSala, stato }),
    }).catch(() => { /* al pacchetto dopo */ });
  }, 250);
}

/** ── DUE VERSI, DUE PAROLE NELL'INDIRIZZO ──────────────────────────────────
 *  La stessa pagina di contenuti serve a due cose opposte, e l'indirizzo dice
 *  quale:
 *   · `?webinar=CODICE` — è dentro la cornice di uno SPETTATORE: deve SEGUIRE
 *     quello che fa il relatore;
 *   · `?regia=CODICE`   — è dentro la regia del RELATORE: deve PUBBLICARE
 *     quello che lui fa.
 *  Senza questa distinzione la regia seguirebbe sé stessa, e nella sala non
 *  arriverebbe mai niente. */
export function salaDallIndirizzo(): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("webinar") || "";
}

/** Il codice della sala quando questa pagina è il contenuto dentro la REGIA:
 *  qui si pubblica, non si segue. */
export function salaDiRegiaDallIndirizzo(): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("regia") || "";
}
