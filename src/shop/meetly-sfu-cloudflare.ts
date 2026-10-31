/** ── MEETLY · IL CLIENT HTTP VERSO L'SFU DI CLOUDFLARE ───────────────────────
 *
 *  Commessa 2026-10-31-meetly-connessione, Parte B (PIANO.md §1.4, §1.5).
 *  Quattro chiamate sole, quelle che servono a Meetly:
 *    · `nuovaSessione`  POST …/sessions/new
 *    · `tracceLocali`   POST …/sessions/<id>/tracks/new  (location "local": pubblico)
 *    · `tracceRemote`   POST …/sessions/<id>/tracks/new  (location "remote": mi abbono)
 *    · `rinegozia`      PUT  …/sessions/<id>/renegotiate
 *
 *  ── ⚠️ PERCHÉ È UN FILE A PARTE ──────────────────────────────────────────
 *  Non importa niente del server (né database, né rotte): prende `appId` e
 *  `token` in ingresso. Così lo importa anche il banco di collaudo (PIANO §5.3),
 *  che lo fa girare in un piccolo server Node suo con i segreti dalla shell, e
 *  lo importano le prove con un `fetch` finto. Nessun segreto qui dentro: li
 *  legge `meetly-sfu.server.ts` da `process.env`.
 *
 *  ── ⚠️ DUE COSE DELLA DOCUMENTAZIONE CLOUDFLARE (letta il 31/10/2026) ────
 *   · «Una risposta HTTP di successo può contenere errori sulle singole
 *     tracce»: ogni voce di `tracks` con `errorCode` è un errore, anche dentro
 *     un 200. Senza questo controllo si registrerebbe come pubblicata una
 *     traccia che l'SFU ha rifiutato, e gli altri si abbonerebbero al nulla.
 *   · Nella pagina «HTTPS API» dell'SFU non c'è nessun ICE restart: la ripresa
 *     di una connessione è una RICOSTRUZIONE (nuova sessione), come nel piano.
 *  Per i versi (pubblicare = offerta nostra; abbonarsi = offerta dell'SFU) vale
 *  quanto scritto in `src/webinar/sfu.ts`: qui sono ripetuti di proposito, il
 *  webinar è in produzione e non si tocca.
 *
 *  ⚠️ Gli errori portano lo STATO e un testo grezzo (`testo`) che serve solo a
 *  chi lo ripulisce prima di scriverlo nel log (il nucleo): il `message` non
 *  contiene mai il token né il corpo. SDP e indirizzi non si registrano. */

const API = "https://rtc.live.cloudflare.com/v1";
/** shortcut: 4 s per chiamata, due chiamate in fila (sessione + tracce) restano sotto gli 8 s
 *  che il client concede al server (TIMEOUT_SERVER_MS); da alzare se l'SFU si dimostra lento. */
const TIMEOUT_MS = 4_000;

export class ErroreCloudflare extends Error {
  /** stato HTTP; 0 = rete o scadenza; 200 = errore dentro una risposta riuscita */
  stato: number;
  /** testo grezzo, MAI da mandare al client */
  testo: string;
  constructor(stato: number, testo: string) {
    super(`Cloudflare ${stato}`);
    this.name = "ErroreCloudflare";
    this.stato = stato;
    this.testo = testo;
  }
}

export interface TracciaLocale {
  mid: string;
  trackName: string;
}
export interface TracciaRemota {
  sessionId: string;
  trackName: string;
}
export interface Cloudflare {
  nuovaSessione(): Promise<string>;
  tracceLocali(sessionId: string, offerSdp: string, tracce: TracciaLocale[]): Promise<{ answerSdp: string }>;
  tracceRemote(
    sessionId: string,
    tracce: TracciaRemota[],
  ): Promise<{ offerSdp: string; serve: boolean; tracce: { mid: string; trackName: string }[] }>;
  rinegozia(sessionId: string, answerSdp: string): Promise<void>;
}

/** L'appId finisce in un indirizzo: solo caratteri da identificativo. */
const APP_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
const percorso = (sessionId: string) => encodeURIComponent(String(sessionId));

export function creaCloudflare(x: {
  appId: string;
  token: string;
  /** per le prove e per il banco */
  fetch?: typeof fetch;
}): Cloudflare {
  if (!APP_ID_RE.test(String(x.appId ?? ""))) throw new Error("appId Cloudflare non valido");
  if (!String(x.token ?? "").trim()) throw new Error("token Cloudflare mancante");
  const f = x.fetch ?? fetch;
  const token = String(x.token).trim();

  async function chiedi(metodo: "POST" | "PUT", cammino: string, corpo?: unknown): Promise<Record<string, any>> {
    let r: Response;
    try {
      r = await f(`${API}/apps/${x.appId}${cammino}`, {
        method: metodo,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (e) {
      throw new ErroreCloudflare(0, String((e as Error)?.name ?? "rete"));
    }
    const testo = await r.text().catch(() => "");
    if (!r.ok) throw new ErroreCloudflare(r.status, testo.slice(0, 300));
    try {
      return (JSON.parse(testo) as Record<string, any>) ?? {};
    } catch {
      throw new ErroreCloudflare(r.status, "risposta non JSON");
    }
  }

  /** ⚠️ Un 200 può contenere errori sulle singole tracce (vedi la testa del file). */
  function senzaErroriSulleTracce(r: Record<string, any>) {
    const rotta = (Array.isArray(r.tracks) ? r.tracks : []).find((t: Record<string, unknown>) => t?.errorCode);
    if (rotta) throw new ErroreCloudflare(200, `traccia rifiutata: ${String(rotta.errorCode)} ${String(rotta.errorDescription ?? "")}`);
  }
  const mappa = (r: Record<string, any>) =>
    (Array.isArray(r.tracks) ? r.tracks : []).map((t: Record<string, unknown>) => ({
      mid: String(t.mid ?? ""),
      trackName: String(t.trackName ?? ""),
    }));

  return {
    async nuovaSessione() {
      const r = await chiedi("POST", "/sessions/new");
      const id = String(r.sessionId ?? "");
      if (!id) throw new ErroreCloudflare(200, "nessun sessionId");
      return id;
    },

    async tracceLocali(sessionId, offerSdp, tracce) {
      const r = await chiedi("POST", `/sessions/${percorso(sessionId)}/tracks/new`, {
        sessionDescription: { type: "offer", sdp: offerSdp },
        tracks: tracce.map((t) => ({ location: "local", mid: t.mid, trackName: t.trackName })),
      });
      senzaErroriSulleTracce(r);
      const answerSdp = String(r.sessionDescription?.sdp ?? "");
      if (!answerSdp) throw new ErroreCloudflare(200, "nessuna risposta SDP");
      return { answerSdp };
    },

    async tracceRemote(sessionId, tracce) {
      const r = await chiedi("POST", `/sessions/${percorso(sessionId)}/tracks/new`, {
        tracks: tracce.map((t) => ({ location: "remote", sessionId: t.sessionId, trackName: t.trackName })),
      });
      senzaErroriSulleTracce(r);
      const offerSdp = String(r.sessionDescription?.sdp ?? "");
      //  Con un'offerta dell'SFU da applicare «serve» rispondere, salvo che dica di no.
      return { offerSdp, serve: !!offerSdp && r.requiresImmediateRenegotiation !== false, tracce: mappa(r) };
    },

    async rinegozia(sessionId, answerSdp) {
      await chiedi("PUT", `/sessions/${percorso(sessionId)}/renegotiate`, {
        sessionDescription: { type: "answer", sdp: answerSdp },
      });
    },
  };
}
