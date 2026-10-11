/** ── LA PAGINA CHE IL CONSULENTE STA MOSTRANDO ─────────────────────────────
 *
 *  Il consulente registra sul server la schermata che il cliente deve vedere,
 *  e il cliente la chiede ogni secondo e ci va. Finché quelle schermate erano
 *  quattro indirizzi secchi — `/slide`, `/preventivo`, `/web`, `/presenta` —
 *  bastava una stringa.
 *
 *  ── ⚠️ POI È ARRIVATA L'ANTEPRIMA CAPELLI, CHE PORTA ROBA CON SÉ ─────────
 *  Il suo indirizzo è `/prova-capelli?meet=<consulenza>&c=<codice>`: la parte
 *  dopo il «?» non è un ornamento, è il codice con cui il cliente può usarla
 *  senza doverne scrivere uno. Passata intera a `navigate({ to })` diventa un
 *  PERCORSO — una rotta che non esiste — e il cliente resta davanti a una
 *  pagina vuota mentre il consulente gli parla.
 *  Qui si separano le due parti una volta sola, e in un posto che si può
 *  provare senza aprire un browser.
 */
export function pezziPagina(indirizzo: string): {
  percorso: string;
  extra: Record<string, string>;
} {
  const [percorso, domanda] = String(indirizzo || "").split("?");
  return {
    percorso: percorso || "",
    //  ⚠️ `watch` non si prende da qui: è di chi guarda, non del consulente, e
    //   quello del consulente (che non ce l'ha) cancellerebbe il suo.
    extra: domanda
      ? Object.fromEntries(
          [...new URLSearchParams(domanda).entries()].filter(([k]) => k !== "watch"),
        )
      : {},
  };
}

/** ── ⚠️ QUALI PAGINE PUÒ VEDERE UN CLIENTE ────────────────────────────────
 *
 *  Segnalazione del committente: «il cliente, quando condivido contenuti,
 *  vede la lista degli utenti di login».
 *
 *  La pagina condivisa si scrive da due punti che prendono l'indirizzo dove il
 *  consulente si trova IN QUEL MOMENTO — l'avvio di una consulenza la registra
 *  con `window.location.pathname`. Se in quel momento è sul cancello dei
 *  presentatori, o su una qualunque schermata interna, quell'indirizzo diventa
 *  la pagina che il cliente segue: e le schermate interne non hanno una
 *  «modalità cliente», quindi si aprono come sono — con l'elenco dei nomi e il
 *  campo del PIN davanti a chi non è dei nostri.
 *
 *  Qui c'è l'elenco delle pagine PENSATE per essere guardate da un cliente. È
 *  corto di proposito: tutto ciò che non è scritto qui non si condivide. Ed è
 *  controllato in DUE punti — chi scrive la pagina corrente e chi la segue —
 *  perché uno solo dei due protegge la metà sbagliata: il consulente può avere
 *  una versione vecchia aperta da ieri, il cliente no.
 *
 *  ⚠️ NON È UN ELENCO DI PERMESSI: qui non si decide chi può, si decide COSA
 *   si può mettere davanti a un cliente. Le porte chiuse stanno altrove (la
 *   sessione da presentatore, i permessi del CRM); questa è la riga che
 *   impedisce di aprirle per sbaglio a chi non ha bussato.
 */
const PAGINE_DEL_CLIENTE = [
  "/slide",
  "/preventivo",
  "/presenta",
  "/web",
  "/prova-capelli",
  "/meetly",
  "/videochiamata",
  "/media",
];

export function paginaMostrabile(indirizzo: string): boolean {
  const { percorso } = pezziPagina(indirizzo);
  if (!percorso.startsWith("/")) return false;
  return PAGINE_DEL_CLIENTE.some((p) => percorso === p || percorso.startsWith(`${p}/`));
}

/** ── ⚠️ DOVE SI CONDUCE UNA CONSULENZA (E DOVE NO) ─────────────────────────
 *
 *  Segnalazione del committente: «quando un cliente entra su Meetly, la
 *  richiesta di accettarlo esce anche sul CRM; deve uscire solo sul Meetly del
 *  consulente che sta facendo il Meetly».
 *
 *  Il motore della consulenza è montato su TUTTA l'applicazione — serve, perché
 *  il consulente cambia schermata di continuo e la chiamata non deve cadere — e
 *  chi ha una consulenza viva in memoria ne diventa il padrone di casa in
 *  qualunque pagina si trovi, CRM compreso. Così il cliente che bussava faceva
 *  comparire il riquadro «fai entrare» anche sopra l'elenco dei lead, dove non
 *  c'entra niente: il consulente sta presentando di là, e quel riquadro è un
 *  comando della consulenza, non del gestionale.
 *
 *  Le pagine dove una consulenza si conduce sono le stesse che il cliente può
 *  vedere: sono le due facce della stessa schermata. Per questo la domanda si
 *  risponde con lo stesso elenco — un secondo elenco vorrebbe dire due idee
 *  diverse di «dove siamo in consulenza», e il giorno in cui una pagina viene
 *  aggiunta a uno solo dei due il guasto torna.
 */
export function quiSiConduce(indirizzo: string): boolean {
  return paginaMostrabile(indirizzo);
}

/** ── ⚠️ NON TUTTO QUELLO CHE STA NELL'INDIRIZZO È DEL CLIENTE ──────────────
 *
 *  L'indirizzo del consulente si porta dietro roba sua: il codice di sblocco,
 *  la sessione da riprendere, il pannello di diagnostica, i segni
 *  dell'anteprima dispositivo. Registrarli come «pagina da mostrare» non è
 *  inutile, è dannoso: `client=1` ed `embed=1` cambiano COME la pagina si
 *  disegna sul dispositivo di chi la apre, e `unlock` è una credenziale che
 *  non deve viaggiare.
 *
 *  Il resto resta: il numero del preventivo o il codice dell'anteprima capelli
 *  servono eccome, ed è per loro che l'indirizzo non si taglia al «?».
 */
const PARAMETRI_DEL_CONSULENTE = ["watch", "session", "unlock", "embed", "client", "debug", "webinar"];

export function indirizzoPerIlCliente(indirizzo: string): string {
  const [percorso, domanda] = String(indirizzo || "").split("?");
  if (!domanda) return percorso;
  const q = new URLSearchParams(domanda);
  for (const k of PARAMETRI_DEL_CONSULENTE) q.delete(k);
  const resto = q.toString();
  return resto ? `${percorso}?${resto}` : percorso;
}

/** ── È GIÀ DOVE LO STIAMO PORTANDO? ───────────────────────────────────────
 *
 *  Segnalazione del committente: «se mostro il preventivo della consulenza e
 *  poi clicco "il suo — lo compila lui", non funziona più: rimane sempre
 *  quello della consulenza».
 *
 *  ⚠️ IL PERCORSO ERA LO STESSO, E BASTAVA QUELLO A FERMARE TUTTO. Il cliente
 *   che sta guardando il preventivo comune è già su `/preventivo`. Quando gli
 *   accendi il suo, il server risponde `/preventivo?persona=pXXXX` — stessa
 *   pagina, persona diversa: è QUEL parametro a dire alla pagina in quale
 *   stanza deve entrare. La guardia anti-rimbalzo però confrontava solo il
 *   percorso, vedeva «è già lì» e non navigava: il `persona` non arrivava mai
 *   nell'indirizzo, la pagina non sapeva di chi fosse, e restava sul comune.
 *   Da fuori: l'interruttore non fa niente — ma solo se prima gli avevi
 *   mostrato il preventivo della consulenza. Ecco il «non funziona più».
 *
 *  ⚠️ E LA GUARDIA SERVE ANCORA: senza, una pagina che si rinavigasse da sola
 *   tornerebbe a rimbalzare. Perciò non si toglie, si guarda meglio: stessa
 *   pagina E stessi parametri che contano. `watch` e `debug` restano fuori —
 *   sono di chi guarda, non del consulente (vedi `pezziPagina`).
 */
export function stessaSchermata(p: {
  /** Dove lo si vuole portare. */
  percorso: string;
  /** I parametri della destinazione (da `pezziPagina`). */
  extra?: Record<string, string> | null;
  /** Dov'è adesso: percorso e ricerca della sua pagina. */
  quiPercorso: string;
  quiRicerca?: string;
}): boolean {
  if (String(p.percorso || "") !== String(p.quiPercorso || "")) return false;
  const qui = new URLSearchParams(String(p.quiRicerca || ""));
  //  `persona` si controlla SEMPRE, anche quando la destinazione non ce l'ha:
  //  spegnere il preventivo di qualcuno vuol dire riportarlo su `/preventivo`
  //  senza persona, ed è un movimento vero quanto l'altro.
  const chiavi = new Set<string>(["persona", ...Object.keys(p.extra || {})]);
  for (const k of chiavi) {
    if (k === "watch" || k === "debug") continue;
    const la = String((p.extra || {})[k] ?? "");
    const ora = String(qui.get(k) ?? "");
    if (la !== ora) return false;
  }
  return true;
}
