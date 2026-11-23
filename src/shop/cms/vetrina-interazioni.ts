/** ── VETRINA V1 · T105 · I RIDUTTORI PURI DELLE INTERAZIONI (D103) ───────────
 *  Funzioni senza schermo: niente React, niente rete, niente timer. Il TEMPO entra come parametro (`adesso`, in millisecondi:
 *  il componente passa `Date.now()`), così ogni transizione si prova senza browser. I riduttori restituiscono STATI (parole
 *  neutre, numeri, booleani), mai frasi: i testi visibili restano in `src/landing/testi-shop.ts`.
 *  Cosa NON è qui, perché senza browser non si prova: il fuoco vero, Esc nel documento, `aria-live`, i timer veri
 *  (2 s e 300 ms) e il banner offline si guardano con Playwright (T103c, T106). Qui sta la logica che li comanda.
 *  Criteri: V1-T12 (parte logica), V1-S2, V1-S3, V1-T15 (offline, scheletri). */

/** Per quanto il bottone dice «Aggiunto» (V1-S3). */
export const DURATA_AGGIUNTO_MS = 2000;
/** Prima di questo ritardo gli scheletri non si mostrano: un'attesa breve non deve lampeggiare (V1-T15). */
export const RITARDO_SCHELETRO_MS = 300;

/** Un istante valido: numero finito. Tutto il resto (null, undefined, NaN) si legge come «mai successo». */
const istante = (t: number | null | undefined): t is number => typeof t === "number" && Number.isFinite(t);

/** Quanto tempo è passato da `da` ad `adesso`; `null` se uno dei due non è un istante o l'orologio è tornato indietro. */
function trascorso(da: number | null | undefined, adesso: number): number | null {
  if (!istante(da) || !istante(adesso) || adesso < da) return null;
  return adesso - da;
}

// ── Bottone «Aggiungi» / «Aggiunto» ──────────────────────────────────────────

export type StatoAggiunta = "aggiungi" | "aggiunto";

/** `aggiuntoIl` = istante dell'ultima aggiunta (`null` se mai). «Aggiunto» vale da quell'istante fino a 2000 ms esclusi:
 *  a 2000 ms il bottone è già di nuovo «aggiungi», lo stesso istante in cui scatta il timer del componente. Un secondo
 *  clic ripassa un `aggiuntoIl` nuovo e il conto riparte. Orologio indietro = «aggiungi», mai «Aggiunto» per sempre. */
export function statoAggiunta(aggiuntoIl: number | null | undefined, adesso: number): StatoAggiunta {
  const t = trascorso(aggiuntoIl, adesso);
  return t !== null && t < DURATA_AGGIUNTO_MS ? "aggiunto" : "aggiungi";
}

// ── Scheletri ────────────────────────────────────────────────────────────────

/** `inizio` = istante in cui è cominciata l'attesa (`null` = nessuna attesa in corso). Vero solo da 300 ms in poi. */
export function mostraScheletro(inizio: number | null | undefined, adesso: number): boolean {
  const t = trascorso(inizio, adesso);
  return t !== null && t >= RITARDO_SCHELETRO_MS;
}

// ── Striscia offline ─────────────────────────────────────────────────────────

export type StatoRete = "online" | "offline";

/** `online` = `navigator.onLine` (o l'ultimo evento `online`/`offline`). Sconosciuto (server, `null`) = «online»:
 *  la striscia non deve comparire a torto. Nessuna memoria: lo stato segue l'ultimo valore ricevuto. */
export function statoRete(online: boolean | null | undefined): StatoRete {
  return online === false ? "offline" : "online";
}

// ── Galleria e lightbox ──────────────────────────────────────────────────────

export type StatoGalleria = { indice: number; totale: number };
export type ComandoGalleria = "avanti" | "indietro" | "primo" | "ultimo" | { vai: number };

/** Numero di foto: intero >= 0 (parte intera; NaN, negativo → 0). */
const quante = (n: number): number => (Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0);
/** Indice portato dentro 0…totale-1 (0 se non ci sono foto). */
const dentro = (i: number, totale: number): number => (totale <= 0 || !Number.isFinite(i) ? 0 : Math.min(Math.max(Math.trunc(i), 0), totale - 1));

/** Un passo della galleria (e della lightbox). Ai bordi si ferma, non gira: `avanti` dall'ultima resta sull'ultima.
 *  Con una foto sola (o nessuna) nessun comando si muove. Restituisce sempre uno stato nuovo; lo stato in ingresso
 *  fuori campo viene riportato dentro prima del passo. */
export function stepGalleria(stato: StatoGalleria, comando: ComandoGalleria): StatoGalleria {
  const totale = quante(stato.totale);
  const i = dentro(stato.indice, totale);
  let prossimo = i;
  if (comando === "avanti") prossimo = i + 1;
  else if (comando === "indietro") prossimo = i - 1;
  else if (comando === "primo") prossimo = 0;
  else if (comando === "ultimo") prossimo = totale - 1;
  else if (typeof comando === "object" && comando !== null && Number.isFinite(comando.vai)) prossimo = comando.vai;
  return { indice: dentro(prossimo, totale), totale };
}

/** Quali controlli si disegnano: con una foto sola nessuno (né frecce, né puntini, né miniature: V1-S2). */
export function controlliGalleria(stato: StatoGalleria): { mostra: boolean; haPrecedente: boolean; haSuccessivo: boolean } {
  const totale = quante(stato.totale);
  const i = dentro(stato.indice, totale);
  const mostra = totale > 1;
  return { mostra, haPrecedente: mostra && i > 0, haSuccessivo: mostra && i < totale - 1 };
}

/** Tasto → comando della galleria (`null` se il tasto non è suo). */
export function comandoDaTasto(tasto: string): ComandoGalleria | null {
  switch (tasto) {
    case "ArrowRight": return "avanti";
    case "ArrowLeft": return "indietro";
    case "Home": return "primo";
    case "End": return "ultimo";
    default: return null;
  }
}

// ── Fogli (menu, filtri, finestre): aperto/chiuso e CHI lo ha aperto ─────────

/** `apertoDa` = identificativo di chi l'ha aperto (finché è aperto); `fuocoA` = a chi restituire il fuoco appena dopo
 *  la chiusura (il componente lo legge, sposta il fuoco, e lo ignora finché non si riapre). */
export type StatoFoglio = { aperto: boolean; apertoDa: string | null; fuocoA: string | null };
export type AzioneFoglio = { tipo: "apri"; da?: string } | { tipo: "chiudi" } | { tipo: "alterna"; da?: string };

export const FOGLIO_CHIUSO: StatoFoglio = Object.freeze({ aperto: false, apertoDa: null, fuocoA: null });

export function foglio(stato: StatoFoglio, azione: AzioneFoglio): StatoFoglio {
  const verbo = azione.tipo === "alterna" ? (stato.aperto ? "chiudi" : "apri") : azione.tipo;
  if (verbo === "apri") {
    // già aperto: resta chi l'ha aperto per primo, il fuoco tornerà al bottone vero
    if (stato.aperto) return stato;
    // senza «chi» si apre lo stesso: nessun fuoco da restituire, mai un fuoco inventato
    const da = "da" in azione && azione.da ? azione.da : null;
    return { aperto: true, apertoDa: da, fuocoA: null };
  }
  if (verbo === "chiudi") {
    if (!stato.aperto) return stato;
    return { aperto: false, apertoDa: null, fuocoA: stato.apertoDa };
  }
  return stato;
}

export type StatoLightbox = StatoFoglio & StatoGalleria;
export type AzioneLightbox =
  | { tipo: "apri"; da?: string; indice: number; totale: number }
  | { tipo: "chiudi" }
  | { tipo: "vai"; comando: ComandoGalleria };

export const LIGHTBOX_CHIUSA: StatoLightbox = Object.freeze({ ...FOGLIO_CHIUSO, indice: 0, totale: 0 });

/** La lightbox è un foglio con un indice. Si apre solo se c'è almeno una foto; i passi valgono solo da aperta;
 *  da chiusa l'indice resta (la galleria sotto può riallinearsi) e `fuocoA` dice a quale diapositiva restituire il fuoco. */
export function lightbox(stato: StatoLightbox, azione: AzioneLightbox): StatoLightbox {
  if (azione.tipo === "vai") {
    if (!stato.aperto) return stato;
    return { ...stato, ...stepGalleria(stato, azione.comando) };
  }
  if (azione.tipo === "apri") {
    const totale = quante(azione.totale);
    if (stato.aperto || totale === 0) return stato;
    return { ...foglio(stato, { tipo: "apri", da: azione.da }), indice: dentro(azione.indice, totale), totale };
  }
  if (azione.tipo === "chiudi") {
    const chiusa = foglio(stato, { tipo: "chiudi" });
    return chiusa === stato ? stato : { ...stato, ...chiusa };
  }
  return stato;
}

// ── Tendina della ricerca ────────────────────────────────────────────────────

export type StatoTendina = { aperta: boolean; indice: number | null };
/** `nessuna` = niente da fare; `apri` = vai alla voce `indice`; `cerca` = vai a `/shop/cerca?q=`; `chiudi` = tendina chiusa da Esc. */
export type AzioneTendina = "nessuna" | "apri" | "cerca" | "chiudi";
/** `gestito` = il riduttore si è preso il tasto: il componente chiama `preventDefault` (e non lo lascia salire). */
export type EsitoTendina = StatoTendina & { azione: AzioneTendina; gestito: boolean };

export const TENDINA_CHIUSA: StatoTendina = Object.freeze({ aperta: false, indice: null });

/** Dopo ogni lettera digitata: la tendina è aperta se ci sono risultati, e nessuna voce è evidenziata. */
export function tendinaDopoDigitazione(totale: number): StatoTendina {
  return { aperta: quante(totale) > 0, indice: null };
}

/** Un tasto nel campo di ricerca con `totale` risultati. Frecce: scorrono e girano (dall'ultima alla prima e viceversa);
 *  da chiusa con risultati si aprono sulla prima (giù) o sull'ultima (su). Invio: voce evidenziata → `apri`, altrimenti `cerca`.
 *  Esc: chiude se aperta; da chiusa non si prende il tasto (spetta al campo o al foglio sopra). Altri tasti: niente. */
export function voceEvidenziata(stato: StatoTendina, tasto: string, totale: number): EsitoTendina {
  const n = quante(totale);
  // senza risultati la tendina non può essere aperta; una voce fuori campo (risultati calati) si toglie
  const aperta = stato.aperta && n > 0;
  const indice = aperta && stato.indice !== null && Number.isInteger(stato.indice) && stato.indice >= 0 && stato.indice < n ? stato.indice : null;
  const invariato: EsitoTendina = { aperta, indice, azione: "nessuna", gestito: false };

  if (tasto === "ArrowDown" || tasto === "ArrowUp") {
    if (n === 0) return invariato;
    const giu = tasto === "ArrowDown";
    const prossimo = indice === null ? (giu ? 0 : n - 1) : giu ? (indice + 1) % n : (indice - 1 + n) % n;
    return { aperta: true, indice: prossimo, azione: "nessuna", gestito: true };
  }
  if (tasto === "Enter") {
    return { aperta: false, indice, azione: indice === null ? "cerca" : "apri", gestito: true };
  }
  if (tasto === "Escape") {
    return aperta ? { aperta: false, indice: null, azione: "chiudi", gestito: true } : invariato;
  }
  return invariato;
}
