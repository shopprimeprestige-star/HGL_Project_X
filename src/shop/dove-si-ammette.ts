/** ── DOVE COMPARE «FAI ENTRARE» ────────────────────────────────────────────
 *
 *  ⚠️⚠️ LEGGI QUESTO PRIMA DI TUTTO IL RESTO — 27/09/2026 ────────────────────
 *  Quello che c'è scritto qui sotto racconta per esteso una regola che NON
 *  vale più del tutto: «se nessun'altra scheda mostra la consulenza, la
 *  richiesta va dove c'è il consulente, GESTIONALE COMPRESO».
 *  Il committente ha poi chiesto l'opposto, con queste parole: «il preventivo
 *  di chi è in consulenza, anche il pulsante per accettare, non devono mai
 *  uscire sul CRM, ma solo dentro la piattaforma Meetly». Perciò oggi fuori
 *  dalle pagine della consulenza non si disegna NIENTE: né la richiesta
 *  d'ingresso, né la sua striscia stretta, né l'avviso «è entrato uno che non
 *  aspettavi», né la plancia dei preventivi di gruppo.
 *  Le guardie che lo impongono NON stanno qui: sono tre `useQuiSiConduce()` in
 *  shop/call.tsx (`KnockPopup`, `AvvisiIngresso`, `PlanciaDelGruppo`).
 *  ⚠️ QUINDI NON È UNA SVISTA DA «CORREGGERE». Chi legge solo il ragionamento
 *   qui sotto — che è ancora giusto in sé — è portato a rimettere la richiesta
 *   sul gestionale credendo di riparare qualcosa: con questo stesso
 *   interruttore è già successo una volta. Quello che si perde con la regola
 *   di oggi è dichiarato: se il cliente bussa mentre il consulente è nel CRM,
 *   lì non compare nulla — resta il campanello (un suono, non un riquadro) e
 *   resta «porta aperta», che li fa entrare da soli.
 *  ⚠️ `siAmmetteQui`, qui sotto, SERVE ANCORA: non decide più «CRM sì o no»,
 *   decide se su una pagina della consulenza il riquadro va grande o
 *   rimpicciolito, quando un'altra scheda sta già mostrando la stessa
 *   consulenza. Le sue prove restano valide.
 *  ──────────────────────────────────────────────────────────────────────────
 *
 *  Due segnalazioni del committente, opposte fra loro, e la seconda è arrivata
 *  perché la prima era stata sistemata male:
 *
 *   1. «quando un cliente entra su Meetly la richiesta di accettarlo esce anche
 *      sul CRM; deve uscire solo sul Meetly del consulente che sta facendo il
 *      Meetly». Risposta di allora: il riquadro si mostra SOLO sulle pagine
 *      della consulenza (vedi `quiSiConduce`).
 *   2. «fai che quando entrano le persone funziona; quando la gente entra non
 *      li ammette». Perché il consulente, mentre aspetta il cliente, sta nel
 *      CRM: apre la sua scheda, controlla il numero, lo chiama. Il cliente
 *      bussa, e la richiesta compariva su una pagina che in quel momento non
 *      era davanti a nessuno. Nessuno la vedeva, nessuno la accettava.
 *
 *  ── LA DOMANDA GIUSTA NON ERA «CHE PAGINA È» ─────────────────────────────
 *  Era: «qualcuno sta guardando la consulenza da un'altra parte?». Se sì, il
 *  riquadro va là e sopra il gestionale non serve — che è esattamente la prima
 *  segnalazione. Se no, va dove c'è il consulente, gestionale compreso: una
 *  richiesta che nessuno può vedere è peggio di una richiesta nel posto
 *  sbagliato, perché il cliente resta alla porta.
 *
 *  Le pagine della consulenza lo dicono accendendo un faro: un annuncio,
 *  ripetuto ogni due secondi su un canale fra le schede dello stesso browser,
 *  che vale «questa scheda sta mostrando la consulenza <codice> adesso». Le
 *  altre schede lo sentono — ed è precisamente la portata che serve, perché la
 *  cosa da sapere è «ho il Meetly aperto di là».
 *
 *  ⚠️ IL FARO SCADE DA SOLO. Una scheda chiusa non fa in tempo a spegnerlo, e un
 *   faro che non scade vorrebbe dire il guasto n° 2 per sempre: il CRM
 *   convinto che il Meetly sia aperto di là, quando quella scheda non esiste
 *   più. Sei secondi = tre annunci mancati.
 *  ⚠️ IL FARO PROPRIO NON CONTA. Una scheda sente anche i propri annunci quando
 *   li ha mandati prima di cambiare pagina, e passando da `/presenta` al CRM si
 *   ritroverebbe quello che aveva acceso lei stessa un istante prima:
 *   preso per buono, il riquadro non comparirebbe nel posto dove ormai si sta
 *   guardando. Per questo ogni scheda ha un suo nome (che le resta anche
 *   attraverso le ricariche, vedi `nomeDiQuestaScheda` in shop/call) e ignora
 *   quello che ha scritto lei.
 *  ⚠️ E DEVE PARLARE DELLA STESSA CONSULENZA: un Meetly aperto su un'ALTRA
 *   consulenza non mostra le richieste di questa.
 *  ───────────────────────────────────────────────────────────────────────── */

/** Il canale su cui le schede si dicono chi sta mostrando la consulenza.
 *  ⚠️ UN CANALE, NON LA MEMORIA DEL BROWSER. Il faro si riscrive ogni due
 *   secondi, e scriverlo nel `localStorage` avrebbe svegliato ogni due secondi
 *   tutte le altre schede: nel CRM ci sono parecchi ascoltatori di `storage`
 *   che non guardano di quale chiave si tratta (la coda degli arretrati, gli
 *   avvisi, le preferenze) e si sarebbero rifatti i conti da capo per una
 *   notizia che non li riguarda. `BroadcastChannel` parla solo a chi ascolta
 *   lui.
 *  ⚠️ E SE IL CANALE NON C'È (browser vecchio) nessuno accende nessun faro: la
 *   richiesta compare in tutti e due i posti. È il verso giusto in cui
 *   sbagliare — un riquadro di troppo, non un cliente alla porta. */
export const CANALE_FARO = "hg-consulenza-a-schermo";

/** Quanto vale un faro prima di considerarlo spento. Chi lo accende lo ripete
 *  ogni 2 s: tre annunci mancati e non vale più. */
export const FARO_TTL_MS = 6000;

export interface Faro {
  /** Il nome della scheda che l'ha accesso. */
  scheda: string;
  /** La consulenza che sta mostrando. */
  code: string;
  /** Quando, in millisecondi. */
  t: number;
}

/** Il faro di questa scheda, pronto da annunciare. */
export function faroDaScrivere(p: { scheda: string; code?: string | null; adesso?: number }): string {
  return JSON.stringify({
    scheda: String(p.scheda || ""),
    code: String(p.code || ""),
    t: p.adesso ?? Date.now(),
  } satisfies Faro);
}

/** Legge il faro annunciato da un'altra scheda. `null` se non c'è o è
 *  illeggibile: sul canale può arrivare qualunque cosa (una versione vecchia
 *  della pagina, ancora aperta da ieri), e un messaggio rotto non deve impedire
 *  a una richiesta di comparire. */
export function leggiFaro(grezzo?: string | null): Faro | null {
  if (!grezzo) return null;
  try {
    const o = JSON.parse(grezzo) as Partial<Faro>;
    const scheda = String(o.scheda || "").trim();
    const t = Number(o.t);
    if (!scheda || !Number.isFinite(t)) return null;
    return { scheda, code: String(o.code || "").trim(), t };
  } catch {
    return null;
  }
}

/** Un'ALTRA scheda sta mostrando QUESTA consulenza, adesso? */
export function unAltraSchermataLaMostra(p: {
  grezzo?: string | null;
  /** Il nome di questa scheda: il suo stesso faro non vale (vedi in testa). */
  miaScheda: string;
  /** La consulenza di cui si sta parlando. */
  codice?: string | null;
  adesso?: number;
}): boolean {
  const f = leggiFaro(p.grezzo);
  if (!f) return false;
  if (f.scheda === String(p.miaScheda || "").trim()) return false;
  const adesso = p.adesso ?? Date.now();
  if (adesso - f.t >= FARO_TTL_MS) return false;
  const mio = String(p.codice || "").trim();
  //  Se una delle due parti non sa di quale consulenza si tratta non si
  //  indovina: si risponde «non la sta mostrando», cioè la richiesta compare.
  //  Meglio un riquadro di troppo che un cliente alla porta.
  if (!mio || !f.code) return false;
  return f.code === mio;
}

/** ── LA DECISIONE ──────────────────────────────────────────────────────────
 *  Sulle pagine della consulenza sempre; altrove solo se non la sta mostrando
 *  nessun altro. */
export function siAmmetteQui(p: {
  /** `quiSiConduce(window.location.pathname)`: questa è una pagina della
   *  consulenza? */
  paginaDellaConsulenza: boolean;
  grezzo?: string | null;
  miaScheda: string;
  codice?: string | null;
  adesso?: number;
}): boolean {
  if (p.paginaDellaConsulenza) return true;
  return !unAltraSchermataLaMostra(p);
}
