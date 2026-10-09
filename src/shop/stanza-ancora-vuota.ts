/** ── «L'HO ACCETTATO E NON RIESCE A ENTRARE» ───────────────────────────────
 *
 *  Segnalazione del committente: «quando le persone entrano io accetto e loro
 *  non riescono a entrare».
 *
 *  ── COSA SUCCEDE DAVVERO, MISURATO ───────────────────────────────────────
 *  L'ingresso funziona. Provato il 8/10/2026 in una stanza finta, dal browser,
 *  seguendo tutta la catena: la bussata arriva al server, il via libera si
 *  scrive sulla riga della persona col suo dispositivo, e la pagina del cliente
 *  lo legge e entra — nel registro si leggono, in fila, «via libera trovato sul
 *  server», «ingresso AUTORIZZATO dal presentatore», «vista gate → connecting →
 *  call». In archivio, tutte le decisioni degli ultimi dieci giorni sono scritte
 *  correttamente, con il dispositivo, sulla riga giusta.
 *
 *  POI IL CLIENTE RESTA DAVANTI A UNO SCHERMO VUOTO. Non una schermata
 *  d'attesa: il nulla. Il corpo della pagina, misurato in quell'istante, era
 *  questo e basta:
 *      <div id="hg-outlet"><div class="bg-blueprint min-h-screen"></div></div>
 *  Nessuna parola, nessun logo, nessun video.
 *
 *  ── PERCHÉ ───────────────────────────────────────────────────────────────
 *  La stanza (`/meetly/<codice>`) non disegna i contenuti: disegna uno sfondo.
 *  I contenuti arrivano perché l'ospite SEGUE il consulente sulla pagina che
 *  sta mostrando (`useLiveNav`). Finché il consulente non ha messo niente a
 *  schermo — e quando si accetta qualcuno quasi sempre non l'ha ancora fatto —
 *  non c'è nessuna pagina da seguire, la videochiamata disegna solo i suoi
 *  comandi sopra il vuoto, e del consulente non arriva ancora nessun video.
 *  Risultato: la persona è DENTRO e vede una pagina nera. Dalla sua parte si
 *  dice in un modo solo: «non riesco a entrare». (Appena si mette una pagina
 *  corrente, nella stessa prova, il cliente ci arriva e vede tutto.)
 *
 *  ⚠️ NON SI RISOLVE FACENDO ENTRARE PRIMA: è già entrato. Si risolve non
 *   lasciando mai uno schermo vuoto a chi è entrato — che è anche la regola
 *   generale di questo programma: un posto che non può mostrare niente dice
 *   perché, non resta bianco.
 *  ⚠️ IL VELO SE NE VA DA SOLO, e non si tocca niente: appena arriva un video
 *   del consulente o una pagina da seguire, questa risposta diventa falsa e
 *   sotto c'è già tutto. Nessuno stato, nessun pulsante, niente da chiudere.
 *  ⚠️ SOLO A CHI È ENTRATO. Prima dell'ingresso ci sono già le sue schermate
 *   (attesa, sala d'attesa, rifiutato): metterne un'altra sopra vorrebbe dire
 *   due schermate per lo stesso momento.
 *  ───────────────────────────────────────────────────────────────────────── */

/** Gli indirizzi che SONO la stanza nuda: quelli che non disegnano contenuti.
 *  Tutto il resto — il preventivo, le slide, il sito, la prova colore — è una
 *  pagina che il cliente sta già guardando. */
const STANZA_NUDA = /^\/(?:meetly|videochiamata)(?:\/|$)/i;

export function eLaStanzaNuda(percorso?: string | null): boolean {
  return STANZA_NUDA.test(String(percorso || ""));
}

/** C'è un ospite entrato che non ha niente davanti?
 *  ⚠️ Le tre condizioni vanno tutte e tre, e nessuna si può togliere:
 *   · `entrato`  — prima dell'ingresso parlano le altre schermate;
 *   · nessun video del consulente — se c'è, lo sta guardando;
 *   · è sulla stanza nuda — se è su una pagina, quella è il contenuto. */
export function stanzaAncoraVuota(p: {
  entrato?: boolean;
  flussiRemoti?: number;
  percorso?: string | null;
}): boolean {
  if (!p?.entrato) return false;
  if ((Number(p.flussiRemoti) || 0) > 0) return false;
  return eLaStanzaNuda(p.percorso);
}
