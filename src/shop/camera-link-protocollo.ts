/** ── LA CAMERA DEL CONSULENTE SUI LINK «SOLO UNA COSA» — LE REGOLE ──────────
 *
 *  Richiesta del committente: «fai che posso attivare e disattivare anche la
 *  mia camera anche su questi link».
 *
 *  I DUE LINK di cui si parla sono `/preventivo?client=1&sess=…` e
 *  `/media-diretta?client=1&sess=…`: il cliente apre, vede quello che gli si
 *  mostra e basta. Niente stanza, niente nome da scrivere, niente sala
 *  d'attesa, e soprattutto NESSUNA richiesta della sua camera o del suo
 *  microfono — è la promessa scritta sul pulsante che copia il link, ed è il
 *  motivo per cui quei link esistono.
 *
 *  ── ⚠️ PERCHÉ UN CANALE NUOVO E NON QUELLO DELLA CHIAMATA ────────────────
 *  La videochiamata vera (`qcall-<codice>`) ha un elenco dei presenti, un
 *  bussare, un far entrare, un moderare. Per far arrivare la faccia del
 *  consulente su questi link bisognerebbe fingere che il cliente sia «entrato»
 *  (`joined: true`): comparirebbe nella lista dei presenti come un ospite vero,
 *  con il pulsante per buttarlo fuori e l'avviso «sta bussando» — davanti a un
 *  cliente che non ha chiesto di entrare da nessuna parte. E una svista in quel
 *  codice si paga sulla consulenza vera, che è la cosa che fa i soldi.
 *
 *  Qui il flusso è UNA DIREZIONE SOLA: il consulente manda, il cliente riceve.
 *  Niente elenco, niente moderazione, niente traccia in uscita dal cliente. Un
 *  canale suo — `qcam-<codice>` — costa una sottoscrizione e non può rompere
 *  niente di quello che c'è già.
 *
 *  ── CHI PARLA, E QUANDO ───────────────────────────────────────────────────
 *   · `camhello`  cliente → «ci sono, il mio nome è pid»
 *   · `camstato`  consulente → «camera accesa / spenta» (a tutti, e in risposta
 *                 a un `camhello`, così chi arriva dopo sa già cosa aspettarsi)
 *   · `camoffer`  consulente → offerta SDP a UN cliente
 *   · `camanswer` cliente → risposta SDP al consulente
 *   · `camice`    tutti e due → candidati di rete
 *
 *  ⚠️ OFFRE SEMPRE IL CONSULENTE. Se offrisse anche il cliente ci sarebbero due
 *   offerte per la stessa connessione (glare) e la negoziazione non si
 *   chiuderebbe mai: è già successo nel motore della chiamata, sta scritto lì.
 *
 *  Questo file NON importa niente — né rete, né React, né Supabase — proprio
 *  perché le regole si possano provare da sole (vedi proveDellaCameraSuiLink).
 *  ───────────────────────────────────────────────────────────────────────── */

/** Il canale della camera per una sessione. Volutamente diverso da
 *  `qcall-<codice>` (la chiamata) e da `qvid-<codice>` (i media). */
export function canaleCamera(sess: string): string {
  return `qcam-${String(sess ?? "").trim()}`;
}

/** I nomi degli annunci, in un posto solo: due parti che si scrivono la stessa
 *  parola in due modi diversi non si sentono, e non se ne accorge nessuno
 *  finché non c'è un cliente davanti. */
export const CAM = {
  ciao: "camhello",
  stato: "camstato",
  offerta: "camoffer",
  risposta: "camanswer",
  rete: "camice",
  /** dove sta e quanto è grande la camerina: la si sposta da una parte e si
   *  sposta anche dall'altra, come in Meetly. */
  pip: "campip",
} as const;

/** Un messaggio indirizzato a qualcuno: `to` è il pid del destinatario. */
export interface MessaggioMirato {
  to?: string;
  from?: string;
}

/** È roba mia? Gli annunci mirati viaggiano sullo stesso canale di tutti:
 *  senza questo controllo un cliente applicherebbe l'offerta fatta a un altro. */
export function perMe(msg: MessaggioMirato | null | undefined, mioPid: string): boolean {
  const a = String(msg?.to ?? "");
  const io = String(mioPid ?? "");
  return !!io && a === io;
}

/** ── SERVE APRIRE UNA CONNESSIONE VERSO QUESTO CLIENTE? ───────────────────
 *  Risponde il consulente, e risponde di sì solo se:
 *   · la camera è davvero accesa — a camera spenta non c'è niente da mandare,
 *     e aprire una connessione vuota vorrebbe dire un riquadro nero sul
 *     dispositivo del cliente invece di nessun riquadro;
 *   · il pid ha un nome — un annuncio senza mittente non si sa a chi
 *     rispondere;
 *   · non gliene abbiamo già aperta una. ⚠️ Due `camhello` ravvicinati (il
 *     cliente ricarica, o la rete duplica l'annuncio) creerebbero DUE
 *     connessioni per la stessa persona: la seconda offerta arriva mentre la
 *     prima sta ancora negoziando e non si chiude più nessuna delle due. */
export function deveOffrire(
  pid: string,
  stato: { accesa: boolean; giaCollegati: Iterable<string> },
): boolean {
  const p = String(pid ?? "").trim();
  if (!p) return false;
  if (!stato.accesa) return false;
  for (const c of stato.giaCollegati) if (c === p) return false;
  return true;
}

/** ── IL CLIENTE DEVE RIANNUNCIARSI? ───────────────────────────────────────
 *  Il cliente dice «ci sono» quando entra, e ogni volta che il consulente
 *  annuncia di aver ACCESO la camera: è il caso normale, perché il link si apre
 *  quasi sempre prima che il consulente accenda.
 *  ⚠️ A camera spenta non ci si riannuncia: sarebbe un annuncio a cui, per
 *   costruzione, nessuno risponde. */
export function deveRiannunciarsi(stato: { on?: unknown }): boolean {
  return stato?.on === true;
}

/** ── SI PUÒ APPLICARE SUBITO QUESTO CANDIDATO DI RETE? ────────────────────
 *
 *  ⚠️ È LA REGOLA DELLO «SCHERMO NERO», e vale la pena leggerla.
 *  I candidati di rete partono appena si trovano, e arrivano quasi sempre
 *  PRIMA che l'altra descrizione SDP sia stata applicata — tanto più che la
 *  prima offerta aspetta anche le credenziali TURN, che sono una chiamata di
 *  rete. Applicarne uno in quel momento fallisce; e un candidato buttato via è
 *  una strada in meno per far passare il video. Il risultato non somiglia a un
 *  errore: la connessione si negozia, tutto sembra a posto, e l'immagine non
 *  arriva mai — un cerchio nero.
 *  Chi risponde `false` non butta niente: mette da parte e riapplica appena la
 *  descrizione c'è. È quello che fa da anni il motore della chiamata
 *  (`pendingIce` in call.tsx). */
export function candidatoApplicabile(
  pc: { remoteDescription?: { type?: string | null } | null } | null | undefined,
): boolean {
  return !!pc && !!pc.remoteDescription && !!pc.remoteDescription.type;
}

/** ── IL CLIENTE DEVE RICHIEDERE? ──────────────────────────────────────────
 *  Un annuncio perso non deve costare la consulenza: finché il consulente dice
 *  di avere la camera accesa e qui non arriva niente, si richiede.
 *  ⚠️ Si smette DA SÉ appena l'immagine c'è: un richiamo ogni quattro secondi
 *   a video già acceso vorrebbe dire una connessione rifatta da capo a ogni
 *   giro, cioè la faccia del consulente che si spegne e si riaccende mentre
 *   sta parlando. */
export function deveRichiedere(stato: {
  vivo: boolean;
  /** c'è già un'immagine in arrivo? */
  riceve: boolean;
  /** il consulente ha detto di avere la camera accesa */
  accesaLaggiu: boolean;
}): boolean {
  return !!stato.vivo && !stato.riceve && !!stato.accesaLaggiu;
}

/** ── LA CONNESSIONE VA RIFATTA DA CAPO? ───────────────────────────────────
 *
 *  ⚠️ È LA REGOLA DEL «OGNI TANTO SI NASCONDE DA SOLA».
 *  Il cliente si riannuncia quando non vede niente; il consulente, ricevendo
 *  l'annuncio, deve decidere se buttare la connessione di prima e rifarla.
 *  Rispondendo di sì troppo presto si fa un disastro: una connessione appena
 *  creata sta in `new` per qualche istante e in `connecting` mentre negozia —
 *  buttarla lì dentro vuol dire ricominciare da capo ogni volta che arriva un
 *  annuncio, cioè un cerchio che compare, sparisce e ridiventa nero mentre il
 *  consulente sta parlando.
 *  Si rifà SOLO quello che è davvero morto: `failed` e `closed`. `disconnected`
 *  è una cosa che si aggiusta da sola quasi sempre (la rete del telefono che
 *  cambia antenna), e il rimedio dev'essere più lento del guasto: chi chiama
 *  aspetta prima di dichiararla persa.
 *  ⚠️ Uno stato che non conosciamo vale «lasciala stare»: il danno di
 *   riaprire a sproposito è visibile, quello di aspettare no. */
export function connessioneDaRifare(
  stato: string | null | undefined,
  opts?: { insistente?: boolean },
): boolean {
  const s = String(stato ?? "");
  if (s === "failed" || s === "closed") return true;
  //  `insistente` = il cliente continua a chiedere da un po': a quel punto
  //  anche un `disconnected` che non si è ripreso va rifatto.
  if (s === "disconnected") return !!opts?.insistente;
  return false;
}

/** Una posizione valida (frazioni 0..1) oppure `null`.
 *  ⚠️ DIFESA: arriva da un messaggio di rete. Un `x` mancante o assurdo
 *   metterebbe la camerina fuori dallo schermo — cioè la farebbe sparire senza
 *   che nessuno capisca perché. */
export function posizioneValida(p: unknown): { x: number; y: number } | null {
  const o = p as { x?: unknown; y?: unknown } | null;
  const x = Number(o?.x);
  const y = Number(o?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) };
}

/** Una misura condivisa valida (frazione della larghezza) oppure `null`.
 *  ⚠️ Gli estremi sono larghi ma non infiniti: una frazione di 12 vorrebbe dire
 *   una camerina dodici volte lo schermo, cioè il contenuto sparito. */
export function frazioneValida(f: unknown): number | null {
  const n = Number(f);
  if (!Number.isFinite(n) || n <= 0 || n > 1.2) return null;
  return n;
}
