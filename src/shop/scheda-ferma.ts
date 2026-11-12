/** ── «PRESENTE MA NON AVVIATO»: UNA SCHEDA FERMA NON BLOCCA UNA SCHEDA IN CHIAMATA ──
 *
 *  Segnalazione del committente: consulente e cliente sono nella stessa stanza e
 *  le camere non si vedono, finché qualcuno non ricarica o riapre il link.
 *
 *  ── DOVE SI ROMPEVA (letto sul codice, confermato dalla scatola nera) ─────────
 *  1. Il consulente ha spesso DUE schede sulla stessa consulenza (o una appena
 *     ricaricata). Quella che non è in chiamata (`S.active` falso) è comunque
 *     «in diretta» e si annuncia ogni 3 s con lo stesso `dev` dell'altra. Il
 *     cliente ha due regole contro i doppioni (`dedupe-dev`, `dedupe-host`) che
 *     buttano la voce vecchia se NON è ancora sana: a ogni saluto della scheda
 *     ferma moriva la connessione, ancora in costruzione, verso quella in
 *     chiamata. Se il saluto cade ~1-2 s dopo l'altro (la fase fra le due schede
 *     non cambia finché non si ricarica) la connessione non fa mai in tempo a
 *     diventare sana: decine di offerte, nessuna risposta.
 *  2. Il cliente apre i media solo se gli arriva `callstate` con `active:true`:
 *     un messaggio solo, a perdere, che il consulente rimanda soltanto a un
 *     pid nuovo. Se il cliente se lo perde non apre mai camera e microfono:
 *     `openMedia` non parte, e il paracadute dei 15 s (`senza-media`) è armato
 *     solo lì dentro, quindi non scatta mai. Nessuno offre, nessuno risponde.
 *  3. Dopo un ricaricamento del consulente il battito (`inChiamata: S.active`)
 *     partiva con `false` PRIMA che la ripresa automatica della chiamata
 *     leggesse il «sì» dal server: la scheda restava per sempre «presente ma
 *     non avviata».
 *
 *  ── LA REGOLA ────────────────────────────────────────────────────────────────
 *  Il saluto del consulente dice se è in chiamata (`act`). Su quella base:
 *  · una scheda che dichiara di NON esserlo non toglie il posto a una che lo è
 *    (o di cui non si sa niente);
 *  · il cliente non offre alla scheda ferma;
 *  · se il consulente dice «sono in chiamata» e il cliente non lo sapeva, apre i
 *    media da solo;
 *  · il battito non cancella «in chiamata» a una scheda che sta per riprenderla.
 *  ⚠️ La modalità «solo contenuti» non cambia: se `act` è falso o ignoto, la
 *   camera del cliente non si apre. */

/** `true` / `false` se il saluto lo dice, `undefined` se non lo dice (scheda vecchia). */
export function inChiamataDichiarata(payload: unknown): boolean | undefined {
  const a = (payload as { act?: unknown } | null | undefined)?.act;
  return a === true ? true : a === false ? false : undefined;
}

/** Chi sta arrivando (`nuovo`) può buttare fuori la voce vecchia? Il sano non si tocca mai;
 *  una scheda ferma non toglie il posto a una in chiamata o di cui non si sa. */
export function puoSostituireVoceHost(p: {
  nuovoInChiamata: boolean | undefined;
  vecchioInChiamata: boolean | undefined;
  vecchioSano: boolean;
}): boolean {
  if (p.vecchioSano) return false;
  if (p.nuovoInChiamata === false && p.vecchioInChiamata !== false) return false;
  return true;
}

/** Il cliente non offre a un consulente che dichiara di non essere in chiamata. */
export function haSensoChiamare(inChiamataDelloAltro: boolean | undefined): boolean {
  return inChiamataDelloAltro !== false;
}

/** Il consulente è in chiamata e questo cliente non lo sapeva: i media si aprono adesso. */
export function devoAvviareMedia(p: {
  hostInChiamata: boolean | undefined;
  miaAttiva: boolean;
}): boolean {
  return p.hostInChiamata === true && !p.miaAttiva;
}

/** Per quanto dopo una ricarica il battito continua a dire «in chiamata» se il server lo diceva. */
export const TIENI_IN_CHIAMATA_MS = 60_000;

/** Che cosa scrive il battito in `inChiamata`: la verità (`attiva`), oppure — per un
 *  minuto dopo una ricarica in cui il server diceva «in chiamata» — quello che il
 *  server già sapeva, così la ripresa automatica fa in tempo a leggerlo. */
export function inChiamataDaBattere(p: {
  attiva: boolean;
  tenutoFinoA: number;
  adesso: number;
}): boolean {
  return p.attiva || p.adesso < p.tenutoFinoA;
}

/** ── LATO SERVER: UN «NO» DI UN'ALTRA SCHEDA NON CANCELLA UN «SÌ» RECENTE ────────
 *  Il battito del consulente scriveva `inChiamata` con «l'ultimo che scrive vince»: una
 *  seconda scheda ferma (`inChiamata:false` ogni 8 s) riportava a «no» la consulenza che
 *  un'altra scheda stava facendo davvero. Conseguenza: la scheda in chiamata, ricaricata,
 *  non si riprendeva (`resumeCallSilently`) e il cliente leggeva «non in chiamata».
 *  Adesso il server ricorda quale scheda ha detto «sì» per ultima, e quando.
 *  · un «no» della STESSA scheda azzera subito;
 *  · un «no» di un'ALTRA scheda non azzera finché il «sì» è fresco;
 *  · senza identificativo (scheda vecchia, da una parte o dall'altra): come prima.
 *  La chiusura esplicita (`live:false`) riscrive la riga intera e non passa di qui.
 *  ⚠️ shortcut: la tenuta è di tre battiti; una scheda in chiamata il cui battito è rallentato
 *   (scheda nascosta: uno al minuto) può lasciarla scadere. Allargarla se si vede succedere. */
export const TENUTA_ALTRA_SCHEDA_MS = 24_000;

export interface InChiamataSalvato {
  inChiamata?: boolean;
  /** Identificativo della scheda che ha detto «sì» per ultima ("" = non si sa). */
  schedaChiamata?: string;
  /** Quando (ISO) l'ha detto. */
  chiamataAt?: string | null;
}

export function inChiamataDelBattito(p: {
  corrente: InChiamataSalvato;
  dichiarato: boolean;
  scheda?: string;
  adesso: number;
}): { inChiamata: boolean; schedaChiamata: string; chiamataAt: string | null } {
  const { corrente: cur, dichiarato, adesso } = p;
  const scheda = p.scheda || "";
  if (dichiarato) return { inChiamata: true, schedaChiamata: scheda, chiamataAt: new Date(adesso).toISOString() };
  const quando = Date.parse(String(cur.chiamataAt || ""));
  const tenuto =
    !!cur.inChiamata &&
    !!cur.schedaChiamata &&
    !!scheda &&
    scheda !== cur.schedaChiamata &&
    Number.isFinite(quando) &&
    adesso - quando < TENUTA_ALTRA_SCHEDA_MS;
  if (tenuto) return { inChiamata: true, schedaChiamata: cur.schedaChiamata!, chiamataAt: cur.chiamataAt! };
  return { inChiamata: false, schedaChiamata: "", chiamataAt: null };
}

/** ── RIFINITURE (terzo giro, 10/11/2026) ────────────────────────────────────── */

/** Il battito HTTP lo cadenza il Worker (come `sendHello`, che gira ogni 3 s): uno ogni N tick.
 *  Con N=2 sono 6 s, quattro battiti dentro i 24 s di `TENUTA_ALTRA_SCHEDA_MS`. Un Worker non viene
 *  rallentato come i timer della scheda nascosta (uno al minuto), che prima lasciavano scadere la tenuta.
 *  ⚠️ shortcut: tenuta lasciata a 24 s (non 70): il Worker rende il rallentamento un caso raro, e una
 *   tenuta lunga farebbe restare «in chiamata» una chiamata finita. Allargarla solo se si misura che il
 *   Worker non basta (CSP che vieta i `blob:` = ripiego sul vecchio timer da 8 s). */
export const OGNI_TICK_BATTITO_HTTP = 2;

/** Dalle risposte pubbliche della rotta si tolgono i campi che servono solo alla logica del server. */
export function senzaCampiInterni<T extends { schedaChiamata?: unknown; chiamataAt?: unknown }>(
  s: T,
): Omit<T, "schedaChiamata" | "chiamataAt"> {
  const { schedaChiamata: _s, chiamataAt: _c, ...pubblici } = s;
  return pubblici;
}

/** Un rapporto «blocco» della scatola nera ha senso solo se la videochiamata è attiva per questa scheda.
 *  Consulente: la sua. Ospite: il consulente gli ha detto `active`, oppure ha `act:true` nel saluto.
 *  Una consulenza di «solo contenuti» non apre camere: non c'è nulla che possa essersi bloccato. */
export function chiamataAttivaPerRapporto(p: {
  ruolo: "host" | "viewer";
  miaAttiva: boolean;
  hostInChiamata: boolean | undefined;
}): boolean {
  if (p.miaAttiva) return true;
  return p.ruolo === "viewer" && p.hostInChiamata === true;
}

/** Quale identificativo di scheda va registrato dal battito. Un «sì» che non arriva con la sessione
 *  del presentatore (cookie: un estraneo con il codice stanza, il link del collega, una pagina con la
 *  sessione scaduta) viene scritto lo stesso — come prima — ma SENZA scheda, quindi non resiste al
 *  «no» del consulente: la tenuta di 24 s è un potere che si concede solo a chi è autenticato.
 *  Il «no» non dà nessun potere in più e passa com'è. */
export function schedaDelSi(p: { scheda: string; dichiarato: boolean; autenticato: boolean }): string {
  return p.dichiarato && !p.autenticato ? "" : p.scheda;
}

/** ── OFFERTE SENZA RISPOSTA (consulenza del 10/11/2026, ore 17:07) ───────────────
 *  Dati veri: consulente in mesh, connessione «new», 53 poi 75 offerte inviate, nessuna risposta, nessun
 *  rapporto dell'ospite. `maybeInitiate` rimanda l'offerta ancora senza risposta a OGNI saluto dell'ospite
 *  («late joiner / offerta persa»): giusto a un saluto ogni 3 s, ma senza nessun limite se i saluti arrivano
 *  più fitti, e senza nemmeno ricordare quando era partita l'ultima. Qui il limite: la STESSA offerta non
 *  riparte prima di `RIMANDA_OFFERTA_OGNI_MS`. Sotto i 3 s del battito, quindi la cadenza normale non cambia.
 *  ⚠️ Non spiega perché l'ospite non risponda: è il tetto al danno (e al rumore nella scatola nera), non la causa.
 *  ⚠️ shortcut: tetto fisso, senza attesa crescente né rinuncia dopo N rinvii; un'offerta identica ripetuta è innocua
 *   per l'ospite (risponde a ogni copia), quindi basta limitarne il ritmo. Aggiungere il backoff se si vede ancora rumore. */
export const RIMANDA_OFFERTA_OGNI_MS = 2_500;

export function puoRimandareOfferta(p: { ultimoInvio: number | undefined; adesso: number }): boolean {
  if (p.ultimoInvio === undefined) return true;
  //  L'orologio che torna indietro (sincronizzazione, cambio ora) non deve bloccare le offerte fino al sorpasso.
  if (p.adesso < p.ultimoInvio) return true;
  return p.adesso - p.ultimoInvio >= RIMANDA_OFFERTA_OGNI_MS;
}
