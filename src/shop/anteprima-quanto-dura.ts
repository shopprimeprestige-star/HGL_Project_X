/** ── QUANTO DEVE DURARE L'ANTEPRIMA DI UN LINK ─────────────────────────────
 *
 *  Segnalazione del committente: «quando invio il preventivo su WhatsApp mostra
 *  l'anteprima, ma dopo 24 ore l'anteprima si toglie dal messaggio ed è
 *  orrendo; anche il link di Meetly la perde. Non deve succedere — o almeno
 *  non prima di 30 giorni».
 *
 *  ── CHE COSA SI È MISURATO ───────────────────────────────────────────────
 *  Chiedendo alla pagina del preventivo con il nome di chi fa le anteprime
 *  (facebookexternalhit, WhatsApp, TelegramBot) e con nessun nome, su un link
 *  di agosto e su uno di oggi:
 *      pagina    200, tutti i tag og: al loro posto, 0,2–0,9 s
 *      immagine  200, image/jpeg, 60.620 byte, anche per il link di agosto
 *  Cioè: da parte nostra non scade NIENTE. Il deposito dell'immagine non ha
 *  scadenza, la pagina risponde uguale il primo giorno e il quarantacinquesimo.
 *
 *  ── ALLORA PERCHÉ L'ANTEPRIMA SPARISCE ───────────────────────────────────
 *  Perché era la nostra risposta a dire «non tenermi»:
 *      pagina    Cache-Control: no-cache, must-revalidate
 *      immagine  Cache-Control: public, max-age=300
 *  Chi fa le anteprime non se le inventa ogni volta: le tiene in cassetto per
 *  il tempo che la risposta dichiara, e quando il tempo scade va a RIPRENDERE
 *  la pagina. Con «non tenermi» il cassetto è vuoto a ogni ridisegno del
 *  messaggio: l'anteprima si regge su una richiesta che deve riuscire ogni
 *  volta, per sempre. Basta un momento storto — la rete del telefono, il tetto
 *  giornaliero di richieste già visto («Error 1027»), una risposta lenta — e
 *  l'anteprima non torna più: il messaggio resta un link nudo.
 *  Dire «tienila trenta giorni» toglie di mezzo tutte quelle occasioni di
 *  sbagliare: il cassetto è pieno, e nessuno deve chiedere niente.
 *
 *  ⚠️ LA CACHE LUNGA VALE SOLO PER CHI FA LE ANTEPRIME. Per un browser vero la
 *   pagina deve restare «non tenermi»: è la regola che fa arrivare un
 *   aggiornamento appena pubblicato, e il giorno che si è tenuta una pagina
 *   vecchia sono spariti i pezzi (vedi il cartello sulle pubblicazioni). Qui
 *   si decide una cosa sola: che cosa rispondere a un LETTORE.
 *  ⚠️ L'IMMAGINE APPENA DEPOSITATA RESTA A CACHE CORTA. L'indirizzo non cambia
 *   mai (è la scelta che tiene in piedi tutto: vedi api.anteprima), quindi se
 *   il consulente ristampa il biglietto perché il primo era sbagliato, l'unico
 *   modo di far arrivare quello nuovo è che il vecchio scada presto. Per un
 *   quarto d'ora la cache è breve, dopo è lunga: la ristampa succede subito o
 *   non succede.
 *  ───────────────────────────────────────────────────────────────────────── */

/** Per quanto tempo un'anteprima appena depositata può ancora cambiare. */
export const RISTAMPA_MS = 15 * 60_000;

/** Trenta giorni, che è la risposta alla domanda del committente. */
export const DURATA_LUNGA_S = 30 * 24 * 60 * 60;

/** Cinque minuti: la finestra della ristampa. */
export const DURATA_BREVE_S = 300;

/** Quanti secondi deve durare l'immagine di questo link. */
export function quantoDuraImmagine(p: { depositataIl?: number | null; adesso?: number }): number {
  const q = p.depositataIl ?? 0;
  if (!q) return DURATA_LUNGA_S;        // non si sa quando: è vecchia di sicuro
  const eta = (p.adesso ?? Date.now()) - q;
  //  ⚠️ Un deposito «nel futuro» è l'orologio del deposito che non coincide
  //   con il nostro: vale come appena fatto, non come impossibile.
  if (eta < 0) return DURATA_BREVE_S;
  return eta < RISTAMPA_MS ? DURATA_BREVE_S : DURATA_LUNGA_S;
}

/** ── CHI FA LE ANTEPRIME ───────────────────────────────────────────────────
 *  L'elenco è ESPLICITO e non finisce con «bot». Una regola larga prima o poi
 *  prende un browser vero — e a un browser vero non si può dare una pagina
 *  vecchia di trenta giorni. */
const LETTORI = [
  "facebookexternalhit",
  "facebookcatalog",
  "facebot",
  "whatsapp",
  "telegrambot",
  "twitterbot",
  "slackbot",
  "slack-imgproxy",
  "linkedinbot",
  "discordbot",
  "skypeuripreview",
  "viber",
  "line-podcast",
  "applebot",       //  iMessage
  "googlebot",      //  le pagine sono noindex, ma la scheda la disegna lo stesso
  "pinterest",
  "redditbot",
  "embedly",
  "quora link preview",
  "vkshare",
  "w3c_validator",
];

export function èUnLettoreDiAnteprime(ua?: string | null): boolean {
  const s = String(ua || "").toLowerCase();
  if (!s) return false;
  return LETTORI.some((x) => s.includes(x));
}

/** ── LE PAGINE CHE SI MANDANO ─────────────────────────────────────────────
 *  Solo quelle il cui indirizzo si manda a qualcuno: il preventivo, la stanza
 *  della consulenza, il biglietto dell'invito, la sala del webinar, la pagina
 *  dei media e la prova capelli. ⚠️ NON il gestionale: una pagina del CRM
 *  tenuta in cassetto per trenta giorni è un guaio, e a un lettore di
 *  anteprime non serve comunque. */
const CONDIVISE = [/^\/preventivo\b/, /^\/meetly\b/, /^\/invito\b/, /^\/webinar\b/, /^\/media\b/, /^\/prova-capelli\b/, /^\/slide\b/];

export function paginaCondivisa(percorso?: string | null): boolean {
  const p = String(percorso || "");
  return CONDIVISE.some((r) => r.test(p));
}

/** Che cosa rispondere a chi sta preparando l'anteprima di questa pagina.
 *  `null` = non è il nostro caso, si lascia esattamente com'era. */
export function cacheDellaPagina(p: {
  ua?: string | null;
  percorso?: string | null;
  metodo?: string | null;
  stato?: number | null;
  tipoContenuto?: string | null;
}): string | null {
  const metodo = String(p.metodo || "GET").toUpperCase();
  if (metodo !== "GET" && metodo !== "HEAD") return null;
  //  Una pagina che non è andata a buon fine non si tiene in cassetto: si
  //  terrebbe l'errore, che è il modo di rompere un'anteprima per sempre.
  if (p.stato != null && p.stato !== 200) return null;
  if (p.tipoContenuto != null && !/text\/html/i.test(String(p.tipoContenuto))) return null;
  if (!èUnLettoreDiAnteprime(p.ua)) return null;
  if (!paginaCondivisa(p.percorso)) return null;
  return `public, max-age=${DURATA_LUNGA_S}`;
}
