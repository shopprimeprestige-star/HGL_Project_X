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
