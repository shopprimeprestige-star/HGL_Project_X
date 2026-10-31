/** ── LA SCATOLA NERA, LATO BROWSER (31/10/2026) ────────────────────────────
 *
 *  Il perché e cosa esce stanno in scatola-nera.ts. Qui c'è il pezzo che
 *  osserva le connessioni: per ogni interlocutore tiene qualche contatore, e
 *  15 secondi dopo averlo incontrato, SE da lui non arriva media vivo, compone
 *  UN rapporto e lo manda. Se poi la connessione si forma, ne manda un secondo
 *  («esito») con il tempo impiegato.
 *
 *  ⚠️ SOLO OSSERVA. Non cambia stati, non apre né chiude connessioni, non
 *   aspetta nessuno: ogni gancio è una riga che incrementa un numero, e tutto
 *   il resto è dentro un try che ingoia gli errori. Se qualcosa qui si rompe,
 *   la chiamata non se ne accorge.
 *  ⚠️ NIENTE DATI PERSONALI. Il rapporto passa da `pulisciRapporto` anche qui,
 *   prima di partire: indirizzi e testi liberi non possono uscire.
 *  ⚠️ UN RAPPORTO PER INTERLOCUTORE, per stanza e per volta. Il tetto sulla
 *   frequenza lo rimette comunque la rotta. */
import {
  ATTESA_MS,
  candidatoDaStat,
  contaCandidati,
  pulisciRapporto,
  riduciCandidato,
  riduciUserAgent,
  type Candidato,
  type Permesso,
  type Rapporto,
} from "./scatola-nera";

export type DipendenzeScatola = {
  /** Il codice della stanza (o null se non c'è). */
  stanza: () => string | null;
  ruolo: () => "consulente" | "ospite";
  /** I server ICE in uso: servono a sapere se le credenziali TURN sono arrivate. */
  iceServers: () => RTCIceServer[];
  peer: (pid: string) => RTCPeerConnection | undefined;
  remoto: (pid: string) => MediaStream | undefined;
  locale: () => MediaStream | null;
  /** C'è media remoto vivo da questo interlocutore? */
  mediaVivo: (pid: string) => boolean;
};

type Stato = {
  rid: string;
  inizio: number;
  timer: ReturnType<typeof setTimeout> | null;
  bloccoInviato: boolean;
  esitoInviato: boolean;
  locali: Candidato[];
  remoti: Candidato[];
  n: {
    offerteInviate: number;
    offerteRicevute: number;
    risposteInviate: number;
    risposteRicevute: number;
    iceInviati: number;
    iceRicevuti: number;
    offerteScartate: number;
  };
};

const rapida = <T>(p: Promise<T>, ms: number, ripiego: T): Promise<T> =>
  Promise.race([p.catch(() => ripiego), new Promise<T>((ok) => setTimeout(() => ok(ripiego), ms))]);

const idCasuale = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 16);

async function permesso(nome: "camera" | "microphone"): Promise<Permesso> {
  const s = await rapida(
    navigator.permissions.query({ name: nome as PermissionName }).then((r) => r.state as string),
    1000,
    "",
  );
  return s === "granted" ? "concesso" : s === "denied" ? "negato" : s === "prompt" ? "da-chiedere" : "ignoto";
}

/** Il candidato scelto dalla connessione, dallo stats (solo tipo/protocollo/porta). */
async function coppiaScelta(pc: RTCPeerConnection) {
  const rep = await rapida(pc.getStats(), 2000, null);
  if (!rep) return null;
  const tutti = new Map<string, any>(); // eslint-disable-line @typescript-eslint/no-explicit-any
  rep.forEach((v) => tutti.set(v.id, v));
  let coppia: any = null; // eslint-disable-line @typescript-eslint/no-explicit-any
  tutti.forEach((v) => {
    if (v.type === "transport" && v.selectedCandidatePairId) coppia = tutti.get(v.selectedCandidatePairId);
  });
  if (!coppia)
    tutti.forEach((v) => {
      if (v.type === "candidate-pair" && (v.selected || (v.nominated && v.state === "succeeded"))) coppia = v;
    });
  if (!coppia) return null;
  const locale = candidatoDaStat(tutti.get(coppia.localCandidateId));
  const remoto = candidatoDaStat(tutti.get(coppia.remoteCandidateId));
  return locale && remoto ? { locale, remoto } : null;
}

export function creaScatola(dip: DipendenzeScatola) {
  const stati = new Map<string, Stato>();
  let ultimoErroreMedia = "";

  async function componi(pid: string, tipo: "blocco" | "esito"): Promise<Rapporto | null> {
    const st = stati.get(pid);
    if (!st) return null;
    const pc = dip.peer(pid);
    const mia = dip.locale();
    const rem = dip.remoto(pid);
    const ua = riduciUserAgent(navigator.userAgent);
    const conn = (navigator as any).connection; // eslint-disable-line @typescript-eslint/no-explicit-any
    const [camera, microfono, coppia] = await Promise.all([
      permesso("camera"),
      permesso("microphone"),
      pc ? coppiaScelta(pc) : Promise.resolve(null),
    ]);
    const tracce = (m: MediaStream | null | undefined, k: "video" | "audio") =>
      (k === "video" ? m?.getVideoTracks() : m?.getAudioTracks())?.length ?? 0;
    const ora = Date.now();
    return pulisciRapporto({
      v: 1,
      rid: st.rid,
      tipo,
      ruolo: dip.ruolo(),
      browser: ua.browser,
      sistema: ua.sistema,
      rete: { tipo: conn?.type ?? "", effettiva: conn?.effectiveType ?? "" },
      hasTurn: dip.iceServers().some((s) => [s.urls].flat().some((u) => /^turns?:/.test(String(u)))),
      stati: {
        signaling: pc?.signalingState ?? "nessuno",
        ice: pc?.iceConnectionState ?? "nessuno",
        connessione: pc?.connectionState ?? "nessuno",
        raccolta: pc?.iceGatheringState ?? "nessuno",
      },
      locali: contaCandidati(st.locali),
      remoti: contaCandidati(st.remoti),
      coppia,
      segnali: st.n,
      permessi: { camera, microfono },
      erroreMedia: ultimoErroreMedia,
      tracce: {
        locali: { video: tracce(mia, "video"), audio: tracce(mia, "audio") },
        remote: {
          video: tracce(rem, "video"),
          audio: tracce(rem, "audio"),
          vive: rem?.getTracks().filter((t) => t.readyState === "live").length ?? 0,
        },
      },
      incontroMs: ora - st.inizio,
      collegatoMs: tipo === "esito" ? ora - st.inizio : null,
    });
  }

  async function invia(pid: string, tipo: "blocco" | "esito") {
    try {
      const sess = dip.stanza();
      const rapporto = await componi(pid, tipo);
      if (!sess || !rapporto) return;
      //  text/plain: richiesta «semplice», niente preflight; `keepalive` la
      //  lascia partire anche se la pagina si chiude subito dopo.
      await fetch("/api/public/meetly-diagnosi", {
        method: "POST",
        keepalive: true,
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body: JSON.stringify({ sess, rapporto }),
      });
    } catch {
      /* la scatola nera non disturba mai la chiamata */
    }
  }

  return {
    /** Ho visto questo interlocutore: parte il conto dei 15 secondi (una volta sola). */
    incontro(pid: string) {
      try {
        if (stati.has(pid)) return;
        const st: Stato = {
          rid: idCasuale(),
          inizio: Date.now(),
          timer: null,
          bloccoInviato: false,
          esitoInviato: false,
          locali: [],
          remoti: [],
          n: { offerteInviate: 0, offerteRicevute: 0, risposteInviate: 0, risposteRicevute: 0, iceInviati: 0, iceRicevuti: 0, offerteScartate: 0 },
        };
        st.timer = setTimeout(() => {
          st.timer = null;
          if (stati.get(pid) !== st || dip.mediaVivo(pid)) return;
          st.bloccoInviato = true;
          void invia(pid, "blocco");
        }, ATTESA_MS);
        stati.set(pid, st);
      } catch {
        /* */
      }
    },
    /** Un messaggio di segnalazione uscito (`inviato`) o arrivato. */
    segnale(pid: string, evento: string, inviato: boolean) {
      const st = stati.get(pid);
      if (!st) return;
      const k = evento === "offer" ? "offerte" : evento === "answer" ? "risposte" : evento === "ice" ? "ice" : "";
      if (!k) return;
      const chiave = (k === "ice" ? (inviato ? "iceInviati" : "iceRicevuti") : `${k}${inviato ? "Inviate" : "Ricevute"}`) as keyof Stato["n"];
      st.n[chiave]++;
    },
    /** Un'offerta arrivata e buttata perché camera e microfono non erano aperti. */
    scartata(pid: string) {
      const st = stati.get(pid);
      if (st) st.n.offerteScartate++;
    },
    /** Un candidato ICE, nostro (`locale`) o dell'altro. Dell'indirizzo non si copia niente. */
    candidato(pid: string, di: "locale" | "remoto", riga: unknown) {
      try {
        const st = stati.get(pid);
        const c = st && typeof riga === "string" ? riduciCandidato(riga) : null;
        if (st && c) (di === "locale" ? st.locali : st.remoti).push(c);
      } catch {
        /* */
      }
    },
    /** Il nome (e solo il nome) dell'errore con cui sono falliti camera e microfono. */
    erroreMedia(e: unknown) {
      ultimoErroreMedia = String((e as { name?: string } | null)?.name || "");
    },
    /** La connessione con questo interlocutore è «connected». Se era stato mandato un blocco, segue l'esito. */
    connesso(pid: string) {
      const st = stati.get(pid);
      if (!st || !st.bloccoInviato || st.esitoInviato) return;
      st.esitoInviato = true;
      void invia(pid, "esito");
    },
    /** L'interlocutore è uscito (o la chiamata è finita): niente più rapporti per lui. */
    chiudi(pid: string) {
      const st = stati.get(pid);
      if (st?.timer) clearTimeout(st.timer);
      stati.delete(pid);
    },
    chiudiTutto() {
      stati.forEach((st) => st.timer && clearTimeout(st.timer));
      stati.clear();
    },
  };
}
