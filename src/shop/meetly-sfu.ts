/** ── MEETLY · IL CLIENT DELL'SFU DI CLOUDFLARE ──────────────────────────────
 *
 *  Commessa 2026-10-31-meetly-connessione, Parte B, compito T3 (piano v2 + note
 *  N1-N5). Le regole pure (stati, ripresa, rapporto unito, nomi delle tracce)
 *  stanno in `meetly-sfu-regole.ts`; qui c'è tutto ciò che tocca il browser.
 *
 *  ── COSA FA ──────────────────────────────────────────────────────────────
 *  `call.tsx` tiene una `RTCPeerConnection` per ogni altro partecipante
 *  (`peers: Map<pid, RTCPeerConnection>`). Con l'SFU non ce n'è nessuna fra i
 *  due browser: ognuno apre DUE connessioni verso Cloudflare (`pub` per
 *  mandare, `sub` per ricevere) e per ogni altro partecipante fabbrica un
 *  ADATTATORE (`nuovoPeer`) che si comporta da `RTCPeerConnection`: così il
 *  resto di `call.tsx` (stato, statistiche, sender, chiusura) non sa niente di
 *  Cloudflare. Presenza, nomi e il «chi c'è e quali tracce» (`hello.sfu`)
 *  restano sul canale di oggi.
 *
 *  ── ⚠️ LE COSE CHE SI SBAGLIANO FACILMENTE ────────────────────────────────
 *   · VERSI OPPOSTI. PUBBLICARE: l'offerta è NOSTRA e l'SFU risponde.
 *     ABBONARSI: l'offerta è dell'SFU e la risposta è nostra. Scambiarli dà una
 *     connessione che resta su «connecting» senza un solo errore.
 *   · NIENTE TRICKLE ICE: l'API è HTTP, l'SDP va spedito completo dopo l'attesa
 *     dei candidati (al massimo 4 s).
 *   · LA MAPPA mid → pid SI RIEMPIE PRIMA di `setRemoteDescription`: l'evento
 *     `track` scatta DENTRO quella chiamata e senza mappa la traccia è anonima.
 *   · UNA CODA SOLA PER IL `sub`: due rinegoziazioni sovrapposte sullo stesso pc
 *     lo mandano in errore. Ogni abbonamento è un lavoro in coda.
 *   · UNO STREAM PER pid (audio + video), e la traccia vecchia dello stesso
 *     tipo si toglie PRIMA di aggiungere la nuova (un `<video>` disegna la prima
 *     traccia video del flusso: se resta quella morta si vede nero).
 *   · NIENTE TRANSCEIVER SENZA TRACCIA: un `replaceTrack` su un transceiver
 *     nato vuoto può non far partire l'SSRC (Safari). Si crea solo ciò che c'è;
 *     se arriva un tipo che mancava (permesso concesso dopo) si RIPUBBLICA, e
 *     questo non consuma il budget delle ricostruzioni.
 *   · IL CAPOFILA. I due pc sono condivisi, ma `call.tsx` chiama `getSenders()`
 *     e `getStats()` su OGNI peer: se tutti rispondessero con i sender veri si
 *     imposterebbe la banda N volte e si conterebbero N volte i byte. Solo il
 *     pid minore fra i vivi (esclusi quelli in chiusura) porta i sender del
 *     `pub` e le voci di uscita/coppie; gli altri `[]` e i soli `inbound-rtp`
 *     delle proprie tracce.
 *   · «connected» VUOL DIRE «LA PERSONA C'È», non «il pc va»: lo stato deriva
 *     da `statoPeer` e include i saluti (`viva(pid)` da ogni `hello`).
 *   · RICOSTRUIRE, NON RIPRENDERE. Cloudflare non prevede l'ICE restart (da
 *     confermare): la ripresa è una ricostruzione del pc guasto, una sola per
 *     guasto anche se l'evento arriva da tre peer, e `sostituisci` ricorda la
 *     traccia CORRENTE per tipo (schermo, nera, sfocata) da ripubblicare.
 *   · NIENTE DATI NEI LOG: mai SDP, codice stanza, nomi. Solo parole fisse.
 *
 *  ── FUNZIONI COPIATE DA `src/webinar/sfu.ts` (DI PROPOSITO) ───────────────
 *  `attendiCandidati`, `iceServers` (fetch su /api/public/turn, STUN pubblici
 *  se non risponde) e il giro `chiediAlServer` (qui `chiama`): il webinar è in
 *  produzione e non si tocca. Copiate, non importate.
 *  ───────────────────────────────────────────────────────────────────────── */
import {
  DISCONNESSO_DOPO_MS,
  GRAZIA_PC_DISCONNESSO_MS,
  MLINE_MORTE_MAX,
  RINNOVA_OGNI_MS,
  RITENTA_OGNI_MS,
  ATTESA_OSPITE_MS,
  TIMEOUT_PUB_MS,
  TIMEOUT_SERVER_MS,
  TIMEOUT_SUB_MS,
  decidiRipresa,
  finisciRicostruzione,
  nuovoStatoRipresa,
  pidDaNomeTraccia,
  pidValido,
  nomiTracce,
  statoPeer,
  unisciRapporti,
  type AnnuncioSfu,
  type MotivoRipiego,
  type StatoPc,
  type TrasportoSfu,
} from "./meetly-sfu-regole";

export type { AnnuncioSfu, MotivoRipiego, TrasportoSfu };

/* ── DIPENDENZE (tutte iniettabili: in Node girano con un pc finto) ───────── */

/** La risposta della rotta: `ok:false` + `error` (codice breve) + `status`. */
export interface RispostaSfu {
  ok: boolean;
  status?: number;
  error?: string;
  [campo: string]: unknown;
}

export interface OrologioSfu {
  adesso(): number;
  /** Ritorna la funzione che annulla. */
  dopo(ms: number, fn: () => void): () => void;
  ogni(ms: number, fn: () => void): () => void;
}

export interface DipendenzeSfu {
  ruolo: "consulente" | "ospite";
  /** Il codice stanza: solo nel corpo delle richieste, mai nei log. */
  codice: string;
  /** Il pid di questa scheda (`genPid` di call.tsx). */
  pid: string;
  /** `dev` e `segreto` della scheda: la rotta li usa per verificare che l'ospite sia «ammesso». */
  credenziali: () => { dev: string; segreto?: string };
  /** `new RTCPeerConnection({ iceServers })`. `quale` serve solo ai finti delle prove. */
  creaPc?: (ice: RTCIceServer[], quale: "pub" | "sub") => RTCPeerConnection;
  /** POST su /api/public/meetly-sfu con `{ azione, ...corpo }`. Torna sempre un oggetto
   *  (anche per 4xx/5xx: `ok:false`, `status`, `error`); può rifiutare per la rete. */
  chiama?: (
    azione: string,
    corpo: Record<string, unknown>,
    opz?: { keepalive?: boolean },
  ) => Promise<RispostaSfu>;
  ice?: () => Promise<RTCIceServer[]>;
  orologio?: OrologioSfu;
  log?: (riga: string) => void;
  creaStream?: () => MediaStream;
}

/** Il collante col browser vero. Letto solo quando serve: nessun effetto all'import. */
const ROTTA = "/api/public/meetly-sfu";
const ICE_RIPIEGO: RTCIceServer[] = [
  { urls: ["stun:stun.cloudflare.com:3478", "stun:stun.l.google.com:19302"] },
];

async function iceVero(): Promise<RTCIceServer[]> {
  try {
    const j = await (await fetch("/api/public/turn", { cache: "no-store" })).json();
    if (Array.isArray(j?.iceServers) && j.iceServers.length) return j.iceServers;
  } catch {
    /* si prosegue con i pubblici */
  }
  return ICE_RIPIEGO;
}

async function chiamaVera(
  azione: string,
  corpo: Record<string, unknown>,
  opz?: { keepalive?: boolean },
): Promise<RispostaSfu> {
  const r = await fetch(ROTTA, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    keepalive: !!opz?.keepalive,
    body: JSON.stringify({ azione, ...corpo }),
  });
  const j = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  return { ...j, ok: r.ok && j?.ok !== false, status: r.status };
}

const orologioVero: OrologioSfu = {
  adesso: () => Date.now(),
  dopo: (ms, fn) => {
    const t = setTimeout(fn, ms);
    return () => clearTimeout(t);
  },
  ogni: (ms, fn) => {
    const t = setInterval(fn, ms);
    return () => clearInterval(t);
  },
};

/* ── PICCOLI ATTREZZI ─────────────────────────────────────────────────────── */

type Tipo = "audio" | "video";
const TIPI: Tipo[] = ["audio", "video"];

const traccivo = (t: MediaStreamTrack | null | undefined): t is MediaStreamTrack =>
  !!t && t.readyState !== "ended";

/** Lo stato del pc → quello della sua vecchia sorella «ice». */
const iceDi = (s: StatoPc): RTCIceConnectionState =>
  s === "connecting" ? "checking" : (s as RTCIceConnectionState);

/** Un pc di `pub` o di `sub`. */
interface Lato {
  pc: RTCPeerConnection;
  /** Da quando il browser lo dà `disconnected` (0 = non lo è). */
  disconnessoDa: number;
  /** Solo `pub`: i sender nati e i tipi pubblicati. */
  sender: Partial<Record<Tipo, RTCRtpSender>>;
  tipi: Partial<Record<Tipo, boolean>>;
  /** Solo `sub`: la sessione che il server ci ha dato. */
  sessionId: string;
}

interface Voce {
  pid: string;
  chiuso: boolean;
  /** L'ultimo stato che abbiamo notificato a `call.tsx`. */
  ultimo: StatoPc;
  facciata: RTCPeerConnection;
}

type Esito = { ok: true; r: RispostaSfu } | { ok: false; status: number; error: string };

const DESCRIZIONE_FINTA = { type: "answer", sdp: "" } as unknown as RTCSessionDescription;

/* ── IL TRASPORTO ─────────────────────────────────────────────────────────── */

export function creaTrasportoSfu(deps: DipendenzeSfu): TrasportoSfu {
  const { ruolo, codice, pid: mioPid } = deps;
  const orologio = deps.orologio ?? orologioVero;
  const chiama = deps.chiama ?? chiamaVera;
  const log = (riga: string) => {
    try {
      deps.log?.(`[SFU] ${riga}`);
    } catch {
      /* un log non rompe niente */
    }
  };
  const creaStream = deps.creaStream ?? (() => new MediaStream());
  const creaPc = deps.creaPc ?? ((ice) => new RTCPeerConnection({ iceServers: ice }));
  const adesso = () => orologio.adesso();

  let cbFallito: ((m: MotivoRipiego) => void) | null = null;
  let cbAnnuncio: (() => void) | null = null;

  let chiuso = false;
  let fallito = false;

  /* Media in uscita. `ultima` è l'ULTIMA traccia messa da `sostituisci` per tipo:
   * serve alla ricostruzione (schermo condiviso, nera, sfocata), mai quella
   * catturata in `avvia`. `undefined` = mai impostata, `null` = tolta. */
  let local: MediaStream | null = null;
  const ultima: Partial<Record<Tipo, MediaStreamTrack | null>> = {};
  const daLocale = (k: Tipo) =>
    (k === "audio" ? local?.getAudioTracks() : local?.getVideoTracks())?.find(traccivo) ?? null;
  const corrente = (k: Tipo): MediaStreamTrack | null => {
    const u = ultima[k];
    return traccivo(u) ? u : daLocale(k);
  };

  /* Le due connessioni verso Cloudflare. */
  let pub: Lato | null = null;
  let sub: Lato | null = null;
  let pubAvviata = false;
  let pubInCorso = false;
  let genPub = 0;
  let chiave = "";
  let annuncioCorrente: AnnuncioSfu | null = null;
  let ultimoRinnova = 0;
  let ricostruzioniFatte = 0;
  let ripresa = nuovoStatoRipresa();

  /* Gli altri. */
  const voci = new Map<string, Voce>();
  const saluti = new Map<string, number>();
  const annunci = new Map<string, AnnuncioSfu>();
  /** pid → chiave dell'annuncio per cui ci siamo già abbonati. */
  const sottoscritti = new Map<string, string>();
  const arrivate = new Map<string, Record<Tipo, boolean>>();
  const flussi = new Map<string, MediaStream>();
  const midDi = new Map<string, { pid: string; kind: Tipo; viva: boolean }>();
  const inCoda = new Set<string>();
  const primoErroreSub = new Map<string, number>();

  /* Orologio: tutti i timer passano di qui, così `chiudiTutto` li ferma. */
  const sveglie = new Set<() => void>();
  const risvegli = new Set<() => void>();
  const timer = (ms: number, fn: () => void) => {
    const annulla = orologio.dopo(ms, () => {
      sveglie.delete(ferma);
      fn();
    });
    const ferma = () => {
      sveglie.delete(ferma);
      annulla();
    };
    sveglie.add(ferma);
    return ferma;
  };
  /** Attesa che si può interrompere: `false` se nel frattempo si è chiuso tutto. */
  const attesa = (ms: number) =>
    new Promise<boolean>((ok) => {
      const ferma = timer(ms, () => {
        risvegli.delete(fine);
        ok(true);
      });
      const fine = () => {
        ferma();
        ok(false);
      };
      risvegli.add(fine);
    });
  let fermaTick: (() => void) | null = null;

  const fallisci = (m: MotivoRipiego) => {
    if (fallito || chiuso) return;
    fallito = true;
    log(`ripiego: ${m}`);
    try {
      cbFallito?.(m);
    } catch {
      /* il chiamante sbaglia da solo */
    }
  };

  /** Una chiamata alla rotta con scadenza (8 s): ciò che non risponde è un guasto. */
  const chiedi = (azione: string, corpo: Record<string, unknown>, opz?: { keepalive?: boolean }) =>
    new Promise<Esito>((ok) => {
      let fatto = false;
      const fine = (e: Esito) => {
        if (fatto) return;
        fatto = true;
        ferma();
        ok(e);
      };
      const ferma = timer(TIMEOUT_SERVER_MS, () =>
        fine({ ok: false, status: 0, error: "timeout" }),
      );
      let p: Promise<RispostaSfu>;
      try {
        p = chiama(azione, corpo, opz);
      } catch {
        fine({ ok: false, status: 0, error: "rete" });
        return;
      }
      p.then(
        (r) =>
          fine(
            r && r.ok
              ? { ok: true, r }
              : { ok: false, status: Number(r?.status) || 0, error: String(r?.error || "") },
          ),
        () => fine({ ok: false, status: 0, error: "rete" }),
      );
    });

  /** Un «non ancora», non un guasto: l'ospite arrivato prima della dichiarazione (409
   *  `non-dichiarato`), stanza piena di righe che scadono (409), limite (429), decisione
   *  della sala d'attesa che deve ancora arrivare al server (403 `non-ammesso`). */
  const nonAncora = (e: { status: number; error: string }) =>
    e.status === 409 || e.status === 429 || (e.status === 403 && e.error === "non-ammesso");
  const escluso = (e: { status: number; error: string }) =>
    e.status === 403 && e.error === "escluso";

  let icePromessa: Promise<RTCIceServer[]> | null = null;
  const iceServers = () => (icePromessa ??= (deps.ice ?? iceVero)().catch(() => ICE_RIPIEGO));

  /** ⚠️ NIENTE TRICKLE: l'SDP si spedisce solo a candidati raccolti (copia di `attendiCandidati`
   *  del webinar, con i timer di qui). Senza scadenza una rete con un candidato che non
   *  arriva mai bloccherebbe tutto. */
  const attendiCandidati = (pc: RTCPeerConnection, msMax = 4000) =>
    new Promise<void>((ok) => {
      if (pc.iceGatheringState === "complete") return ok();
      let fatto = false;
      const suCambio = () => {
        if (pc.iceGatheringState === "complete") finisci();
      };
      const finisci = () => {
        if (fatto) return;
        fatto = true;
        pc.removeEventListener("icegatheringstatechange", suCambio);
        ferma();
        ok();
      };
      pc.addEventListener("icegatheringstatechange", suCambio);
      const ferma = timer(msMax, finisci);
    });

  /** `true` appena il pc è `connected`, `false` se fallisce o scade. */
  const attendiConnesso = (pc: RTCPeerConnection, ms: number) =>
    new Promise<boolean>((ok) => {
      const stato = () => pc.connectionState;
      if (stato() === "connected") return ok(true);
      if (stato() === "failed" || stato() === "closed") return ok(false);
      let fatto = false;
      const suCambio = () => {
        if (stato() === "connected") finisci(true);
        else if (stato() === "failed" || stato() === "closed") finisci(false);
      };
      const finisci = (v: boolean) => {
        if (fatto) return;
        fatto = true;
        pc.removeEventListener("connectionstatechange", suCambio);
        ferma();
        ok(v);
      };
      pc.addEventListener("connectionstatechange", suCambio);
      const ferma = timer(ms, () => finisci(false));
    });

  /* ── STATO DELLA PERSONA ─────────────────────────────────────────────── */

  const completo = (pid: string): boolean => {
    const a = annunci.get(pid);
    const r = arrivate.get(pid);
    if (!a || !r || !(a.a || a.v)) return false;
    return (!a.a || r.audio) && (!a.v || r.video);
  };

  const statoLato = (l: Lato | null): StatoPc => (l ? (l.pc.connectionState as StatoPc) : "new");
  const salutoRecente = (pid: string) => {
    const t = saluti.get(pid) ?? 0;
    return t > 0 && adesso() - t <= DISCONNESSO_DOPO_MS;
  };

  const calcola = (v: Voce): StatoPc => {
    if (v.chiuso) return "closed";
    const giu = [pub, sub]
      .filter((l) => l && l.disconnessoDa > 0 && statoLato(l) === "disconnected")
      .map((l) => l!.disconnessoDa);
    return statoPeer({
      adesso: adesso(),
      chiuso: false,
      pub: statoLato(pub),
      sub: statoLato(sub),
      disconnessoDa: giu.length ? Math.min(...giu) : 0,
      tracce: completo(v.pid),
      ultimoSaluto: saluti.get(v.pid) ?? 0,
    });
  };

  /** Notifica a `call.tsx` i cambi di stato, come farebbe un pc vero. */
  const ricalcolaTutti = () => {
    for (const v of [...voci.values()]) {
      const nuovo = calcola(v);
      if (nuovo === v.ultimo) continue;
      v.ultimo = nuovo;
      try {
        v.facciata.onconnectionstatechange?.(null as never);
      } catch {
        /* è il suo gestore */
      }
      try {
        v.facciata.oniceconnectionstatechange?.(null as never);
      } catch {
        /* idem */
      }
    }
  };

  /** Il capofila: il pid minore fra i vivi (mai uno in chiusura). */
  const capofila = (): string | null => {
    let m: string | null = null;
    for (const v of voci.values()) if (!v.chiuso && (m === null || v.pid < m)) m = v.pid;
    return m;
  };

  /* ── PUBBLICARE ──────────────────────────────────────────────────────── */

  const tipoMancante = () => !!pub && TIPI.some((k) => corrente(k) && !pub!.tipi[k]);

  /** Dopo la pubblicazione: la traccia sul sender deve essere quella di adesso
   *  (può essere cambiata mentre si negoziava). */
  const riallinea = () => {
    if (!pub) return;
    for (const k of TIPI) {
      const s = pub.sender[k];
      const voluta = corrente(k);
      if (s && voluta && s.track !== voluta)
        void s.replaceTrack(voluta).catch(() => log("sostituzione traccia non riuscita"));
    }
  };

  const chiudiLato = (l: Lato | null) => {
    if (!l) return;
    try {
      l.pc.close();
    } catch {
      /* già chiuso */
    }
  };

  /** Pubblica le tracce CORRENTI. `ricostruzione`: il pc `pub` precedente c'era ed è guasto
   *  (o manca un tipo) → lo si chiude e se ne fa uno nuovo; la `chiave` già avuta serve al
   *  server per riconoscere che è lo stesso pid. `true` = pubblicato. */
  async function pubblica(ricostruzione: boolean): Promise<boolean> {
    const mio = ++genPub;
    pubInCorso = true;
    const vecchio = () => chiuso || fallito || mio !== genPub;
    try {
      if (!pidValido(mioPid)) {
        fallisci("server");
        return false;
      }
      if (pub) {
        chiudiLato(pub);
        pub = null;
      }
      annuncioCorrente = null;
      const ice = await iceServers();
      if (vecchio()) return false;

      const pc = creaPc(ice, "pub");
      const lato: Lato = { pc, disconnessoDa: 0, sender: {}, tipi: {}, sessionId: "" };
      const mid: Partial<Record<Tipo, RTCRtpTransceiver>> = {};
      //  ⚠️ Solo i tipi che hanno una traccia: niente transceiver nato vuoto. E la traccia è
      //   quella stessa di `localStream`, così il mute (`enabled=false`) arriva davvero.
      for (const k of TIPI) {
        const t = corrente(k);
        if (!t) continue;
        const tr = pc.addTransceiver(t, { direction: "sendonly" });
        mid[k] = tr;
        lato.sender[k] = tr.sender;
        lato.tipi[k] = true;
      }
      if (!mid.audio && !mid.video) {
        try {
          pc.close();
        } catch {
          /* niente da chiudere */
        }
        return false;
      }
      pub = lato;
      agganciaLato(lato, "pub");
      await pc.setLocalDescription(await pc.createOffer());
      await attendiCandidati(pc);
      if (vecchio() || pub !== lato) return false;

      const cred = deps.credenziali();
      const corpo: Record<string, unknown> = {
        codice,
        pid: mioPid,
        dev: cred.dev,
        segreto: cred.segreto,
        offerSdp: pc.localDescription?.sdp || "",
        midAudio: mid.audio?.mid || "",
        midVideo: mid.video?.mid || "",
        ...(chiave ? { chiave } : {}),
      };

      const inizio = adesso();
      let tentativiRete = 0;
      let risposta: RispostaSfu;
      for (;;) {
        const es = await chiedi("pubblica", corpo);
        if (es.ok && (chiuso || mio !== genPub)) {
          //  Uscita forzata mentre il server rispondeva: la riga non deve restare viva.
          if (chiuso && es.r.chiave)
            void chiama(
              "esci",
              { codice, pid: mioPid, chiave: String(es.r.chiave) },
              { keepalive: true },
            ).catch(() => {});
          return false;
        }
        if (vecchio()) return false;
        if (es.ok) {
          risposta = es.r;
          break;
        }
        if (es.error === "non-configurato") {
          fallisci("non-configurato");
          return false;
        }
        if (escluso(es)) {
          log("pubblica: escluso dalla stanza");
          return false;
        }
        if (nonAncora(es)) {
          //  ⚠️ Non è un guasto: il consulente non ha ancora dichiarato, o la sala non ha ancora
          //   ammesso, o la stanza è piena di righe che scadono. Si riprova ~20 s (N2).
          if (adesso() - inizio < ATTESA_OSPITE_MS) {
            if (!(await attesa(RITENTA_OGNI_MS)) || vecchio()) return false;
            continue;
          }
          fallisci("server");
          return false;
        }
        //  Guasto vero (5xx, rete, scadenza, `cloudflare`): l'ospite riprova una volta (paletto
        //  del revisore: due tentativi falliti per rete prima di chiedere il ripiego di tutti).
        tentativiRete++;
        if (ruolo === "ospite" && tentativiRete < 2) {
          if (!(await attesa(RITENTA_OGNI_MS)) || vecchio()) return false;
          continue;
        }
        fallisci("server");
        return false;
      }

      const sessionId = String(risposta.sessionId || "");
      const nuovaChiave = String(risposta.chiave || chiave || "");
      const risp = String(risposta.answerSdp || "");
      if (!sessionId || !risp || !nuovaChiave) {
        fallisci("server");
        return false;
      }
      chiave = nuovaChiave;
      lato.sessionId = sessionId;
      await pc.setRemoteDescription({ type: "answer", sdp: risp });
      if (vecchio() || pub !== lato) return false;

      annuncioCorrente = {
        s: sessionId,
        a: lato.tipi.audio ? String(risposta.audio || nomiTracce(mioPid).audio) : "",
        v: lato.tipi.video ? String(risposta.video || nomiTracce(mioPid).video) : "",
      };
      ultimoRinnova = adesso();
      riallinea();
      try {
        cbAnnuncio?.();
      } catch {
        /* è il suo gestore */
      }
      if (!ricostruzione) {
        //  Il pub deve collegarsi entro 12 s (se nel frattempo è stato ricostruito, ci pensa chi
        //  ricostruisce).
        void attendiConnesso(pc, TIMEOUT_PUB_MS).then((ok) => {
          if (!ok && pub === lato && !chiuso && !fallito) fallisci("timeout-pub");
        });
      }
      return true;
    } catch (e) {
      log(`pubblica: errore del pc (${e instanceof Error ? e.name : "?"})`);
      if (!chiuso && !fallito && mio === genPub) fallisci("server");
      return false;
    } finally {
      if (mio === genPub) pubInCorso = false;
      vaiAvanti();
    }
  }

  /* ── ABBONARSI (UNA CODA SOLA) ───────────────────────────────────────── */

  let coda: Promise<unknown> = Promise.resolve();
  const accoda = (lavoro: () => Promise<void>): Promise<void> => {
    const p = coda.then(lavoro).catch(() => undefined) as Promise<void>;
    coda = p;
    return p;
  };

  const chiaveAnnuncio = (a: AnnuncioSfu) => `${a.s}|${a.a}|${a.v}`;
  const flussoDi = (pid: string) => {
    let f = flussi.get(pid);
    if (!f) flussi.set(pid, (f = creaStream()));
    return f;
  };

  /** Una traccia remota è arrivata. Si sa di chi è solo dalla mappa mid → pid. */
  const suTraccia = (e: RTCTrackEvent) => {
    const info = midDi.get(String(e.transceiver?.mid ?? ""));
    if (!info || !info.viva) return;
    const v = voci.get(info.pid);
    if (!v || v.chiuso) return;
    const flusso = flussoDi(info.pid);
    //  ⚠️ Si toglie PRIMA la vecchia dello stesso tipo, poi si aggiunge la nuova.
    for (const vecchia of flusso.getTracks()) {
      if (vecchia.kind === e.track.kind && vecchia !== e.track) flusso.removeTrack(vecchia);
    }
    if (!flusso.getTracks().includes(e.track)) flusso.addTrack(e.track);
    const r = arrivate.get(info.pid) ?? { audio: false, video: false };
    r[info.kind] = true;
    arrivate.set(info.pid, r);
    try {
      v.facciata.ontrack?.({
        track: e.track,
        streams: [flusso],
        receiver: e.receiver,
        transceiver: e.transceiver,
      } as unknown as RTCTrackEvent);
    } catch {
      /* è il suo gestore */
    }
    ricalcolaTutti();
  };

  /** Le m-line del `sub` di un pid non servono più (se n'è andato o ha ripubblicato).
   *  Senza `tracks/close` si accumulano: oltre 12 si ricostruisce il solo `sub` (fuori budget). */
  const segnaMorte = (pid: string) => {
    let morte = 0;
    for (const i of midDi.values()) {
      if (i.pid === pid) i.viva = false;
      if (!i.viva) morte++;
    }
    if (morte <= MLINE_MORTE_MAX) return;
    const e = decidiRipresa(ripresa, { adesso: adesso(), tipo: "mline-morte", mlineMorte: morte });
    ripresa = e.stato;
    if (e.azione === "ricostruisci") void ricostruisci("sub");
  };

  async function lavoraSub(pid: string): Promise<void> {
    inCoda.delete(pid);
    const v = voci.get(pid);
    const a = annunci.get(pid);
    if (chiuso || fallito || !v || v.chiuso || !a || !chiave) return;
    const k = chiaveAnnuncio(a);
    if (sottoscritti.get(pid) === k) return;
    const tracce = [a.a, a.v].filter(Boolean).map((trackName) => ({ sessionId: a.s, trackName }));
    if (!tracce.length) return;
    try {
      if (!sub) {
        const ice = await iceServers();
        if (chiuso || fallito) return;
        const pc = creaPc(ice, "sub");
        sub = { pc, disconnessoDa: 0, sender: {}, tipi: {}, sessionId: "" };
        agganciaLato(sub, "sub");
        pc.addEventListener("track", suTraccia as EventListener);
      }
      const lato = sub;
      const es = await chiedi("abbonati", {
        codice,
        pid: mioPid,
        chiave,
        tracce,
        ...(lato.sessionId ? { subSessionId: lato.sessionId } : {}),
      });
      if (chiuso || fallito || sub !== lato) return;
      if (!es.ok) {
        erroreSub(pid, es);
        return;
      }
      primoErroreSub.delete(pid);
      lato.sessionId = String(es.r.subSessionId || lato.sessionId || "");
      //  ⚠️ La mappa mid → pid PRIMA della setRemoteDescription: `track` scatta lì dentro.
      for (const t of (es.r.tracce as { mid: unknown; trackName: unknown }[] | undefined) ?? []) {
        const n = pidDaNomeTraccia(t?.trackName);
        if (n && n.pid === pid && t.mid !== undefined && t.mid !== "")
          midDi.set(String(t.mid), { pid, kind: n.kind, viva: true });
      }
      sottoscritti.set(pid, k);
      arrivate.set(pid, { audio: false, video: false });
      const offerta = String(es.r.offerSdp || "");
      if (offerta) {
        //  ⚠️ Qui l'offerta è dell'SFU: noi rispondiamo, poi lo diciamo al server.
        await lato.pc.setRemoteDescription({ type: "offer", sdp: offerta });
        await lato.pc.setLocalDescription(await lato.pc.createAnswer());
        await attendiCandidati(lato.pc);
        if (chiuso || fallito || sub !== lato) return;
        const r2 = await chiedi("rinegozia", {
          codice,
          pid: mioPid,
          chiave,
          subSessionId: lato.sessionId,
          answerSdp: lato.pc.localDescription?.sdp || "",
        });
        if (chiuso || fallito || sub !== lato) return;
        if (!r2.ok) {
          sottoscritti.delete(pid);
          erroreSub(pid, r2);
          return;
        }
      }
      timer(TIMEOUT_SUB_MS, () => controllaTracce(pid, k));
    } catch (e) {
      log(`abbonati: errore del pc (${e instanceof Error ? e.name : "?"})`);
      sottoscritti.delete(pid);
      guasto("sub");
    } finally {
      ricalcolaTutti();
    }
  }

  const erroreSub = (pid: string, es: { status: number; error: string }) => {
    sottoscritti.delete(pid);
    if (es.error === "non-configurato") return fallisci("non-configurato");
    if (escluso(es)) return log("abbonati: escluso dalla stanza");
    if (nonAncora(es)) {
      const t = primoErroreSub.get(pid) ?? adesso();
      primoErroreSub.set(pid, t);
      if (adesso() - t < ATTESA_OSPITE_MS) {
        timer(RITENTA_OGNI_MS, vaiAvanti);
        return;
      }
    }
    fallisci("server");
  };

  /** 15 s dopo un abbonamento riuscito le tracce di quel pid dovrebbero esserci. */
  const controllaTracce = (pid: string, k: string) => {
    if (chiuso || fallito || sottoscritti.get(pid) !== k) return;
    const v = voci.get(pid);
    if (!v || v.chiuso || completo(pid)) return;
    if (sub?.pc.connectionState !== "connected") {
      //  Il `sub` non si è collegato e non è arrivato niente da nessuno: ripiego. Se invece
      //  arrivano tracce degli altri, il guasto lo gestisce l'evento del pc.
      if (![...arrivate.values()].some((r) => r.audio || r.video)) fallisci("timeout-sub");
      return;
    }
    riabbonaSePuoi(pid);
  };

  /** Pc sani ma UN pid muto: si riabbona solo lui (max 2 al minuto), mai ripiego. */
  const riabbonaSePuoi = (pid: string) => {
    const e = decidiRipresa(ripresa, {
      adesso: adesso(),
      tipo: "pid-muto",
      pid,
      pidHaSalutato: salutoRecente(pid),
    });
    ripresa = e.stato;
    if (e.azione === "riabbona") riabbona(pid);
  };
  const riabbona = (pid: string) => {
    sottoscritti.delete(pid);
    arrivate.set(pid, { audio: false, video: false });
    segnaMorte(pid);
    vaiAvanti();
  };

  /* ── RICOSTRUIRE ─────────────────────────────────────────────────────── */

  const pcGuasto = (l: Lato | null) =>
    !!l &&
    (statoLato(l) === "failed" ||
      (statoLato(l) === "disconnected" &&
        l.disconnessoDa > 0 &&
        adesso() - l.disconnessoDa >= GRAZIA_PC_DISCONNESSO_MS));

  /** Un guasto di `pub` o `sub`. Un guasto del `sub` fa scattare l'evento su OGNI peer, e
   *  anche `riparaLeConnessioni` e `gcRoster` chiedono la ripresa: `decidiRipresa` fonde. */
  function guasto(quale: "pub" | "sub") {
    if (chiuso || fallito) return;
    if (quale === "pub" && pubInCorso) return;
    const e = decidiRipresa(ripresa, { adesso: adesso(), tipo: quale });
    ripresa = e.stato;
    if (e.azione === "ripiega") fallisci("ice-fallita");
    else if (e.azione === "ricostruisci") void ricostruisci(quale);
  }

  async function ricostruisci(quale: "pub" | "sub"): Promise<void> {
    let persistito = true;
    try {
      if (quale === "pub") {
        const ok = await pubblica(true);
        const nuovo = pub as Lato | null;
        persistito = ok && nuovo ? !(await attendiConnesso(nuovo.pc, TIMEOUT_PUB_MS)) : true;
      } else {
        persistito = !(await ricostruisciSub());
      }
    } catch (e) {
      log(`ricostruzione: errore (${e instanceof Error ? e.name : "?"})`);
    } finally {
      ripresa = finisciRicostruzione(ripresa, quale, adesso(), persistito);
      ricostruzioniFatte++;
    }
    //  Se il guasto c'è ancora si rientra: `decidiRipresa` ricostruisce di nuovo oppure, a 3
    //  ricostruzioni persistite in 5 minuti, ripiega.
    if (persistito && !chiuso && !fallito) guasto(quale);
  }

  /** Il `sub` nuovo, con tutti gli abbonamenti rifatti. `true` = collegato. */
  async function ricostruisciSub(): Promise<boolean> {
    await accoda(async () => {
      chiudiLato(sub);
      sub = null;
      midDi.clear();
      sottoscritti.clear();
      for (const pid of arrivate.keys()) arrivate.set(pid, { audio: false, video: false });
    });
    if (chiuso || fallito) return true;
    vaiAvanti();
    await coda;
    return sub ? attendiConnesso((sub as Lato).pc, TIMEOUT_SUB_MS) : true;
  }

  function agganciaLato(l: Lato, quale: "pub" | "sub") {
    l.pc.addEventListener("connectionstatechange", () => {
      if ((quale === "pub" ? pub : sub) !== l) return;
      const st = l.pc.connectionState;
      l.disconnessoDa = st === "disconnected" ? l.disconnessoDa || adesso() : 0;
      ricalcolaTutti();
      if (st === "failed") guasto(quale);
      else if (st === "disconnected") {
        //  Un pc che si riprende da solo in pochi secondi non è una caduta.
        timer(GRAZIA_PC_DISCONNESSO_MS, () => {
          if ((quale === "pub" ? pub : sub) === l && l.pc.connectionState === "disconnected")
            guasto(quale);
        });
      }
    });
  }

  /* ── IL GIRO CHE METTE TUTTO IN FILA ─────────────────────────────────── */

  /** Idempotente: guarda cosa manca e lo avvia. Si richiama da ovunque (nuovi pid, annunci, media). */
  function vaiAvanti() {
    if (chiuso || fallito) return;
    if (local && !pubAvviata && voci.size > 0 && (corrente("audio") || corrente("video"))) {
      pubAvviata = true;
      void pubblica(false);
    } else if (pub && !pubInCorso && tipoMancante()) {
      //  Un tipo di traccia che mancava è arrivato (permesso concesso dopo): si ripubblica,
      //  e NON conta nel budget.
      const e = decidiRipresa(ripresa, { adesso: adesso(), tipo: "tipo-arrivato" });
      ripresa = e.stato;
      if (e.azione === "ricostruisci") void ricostruisci("pub");
    }
    if (chiave) {
      for (const [pid, a] of annunci) {
        if (voci.has(pid) && !inCoda.has(pid) && sottoscritti.get(pid) !== chiaveAnnuncio(a)) {
          inCoda.add(pid);
          void accoda(() => lavoraSub(pid));
        }
      }
    }
    ricalcolaTutti();
  }

  const avviaTick = () => {
    if (fermaTick || chiuso) return;
    //  ⚠️ In una scheda nascosta il browser rallenta i timer: gli scatti 12/25 s possono
    //   arrivare in ritardo (come i `gcRoster` di oggi). `viva()` ricalcola comunque.
    fermaTick = orologio.ogni(1000, () => {
      ricalcolaTutti();
      if (chiave && !pubInCorso && adesso() - ultimoRinnova >= RINNOVA_OGNI_MS) {
        ultimoRinnova = adesso();
        //  Il battito tiene viva la riga sul server. Se non va non è un guasto (N4b).
        void chiedi("rinnova", { codice, pid: mioPid, chiave }).then((es) => {
          if (!es.ok) log("rinnova: non riuscito");
        });
      }
    });
  };

  /* ── IL PEER (L'ADATTATORE) ──────────────────────────────────────────── */

  const chiudiVoce = (v: Voce) => {
    if (v.chiuso) return;
    v.chiuso = true;
    const pid = v.pid;
    if (voci.get(pid) === v) {
      voci.delete(pid);
      //  ⚠️ Si azzera l'annuncio di quel pid: il prossimo `hello` con lo stesso annuncio deve
      //   riabbonare, altrimenti il pid resta «connecting» fino al timeout.
      annunci.delete(pid);
      sottoscritti.delete(pid);
      arrivate.delete(pid);
      primoErroreSub.delete(pid);
      const f = flussi.get(pid);
      if (f) for (const t of f.getTracks()) f.removeTrack(t);
      flussi.delete(pid);
      segnaMorte(pid);
    }
  };

  const eMiaTraccia = (pid: string, inbound: { mid?: unknown; trackIdentifier?: unknown }) => {
    const i = midDi.get(String(inbound.mid ?? ""));
    if (i) return i.pid === pid;
    return !!flussi
      .get(pid)
      ?.getTracks()
      .some((t) => t.id === inbound.trackIdentifier);
  };

  function nuovoPeer(pid: string): RTCPeerConnection {
    const esistente = voci.get(pid);
    if (esistente && !esistente.chiuso) return esistente.facciata;
    avviaTick();
    const facciata = {
      onconnectionstatechange: null as (() => void) | null,
      oniceconnectionstatechange: null as (() => void) | null,
      ontrack: null as ((e: RTCTrackEvent) => void) | null,
      onicecandidate: null as unknown,
      get connectionState() {
        return voce.chiuso ? "closed" : calcola(voce);
      },
      get iceConnectionState() {
        return iceDi(voce.chiuso ? "closed" : calcola(voce));
      },
      get signalingState() {
        return "stable";
      },
      get localDescription() {
        return DESCRIZIONE_FINTA;
      },
      get remoteDescription() {
        return DESCRIZIONE_FINTA;
      },
      get currentRemoteDescription() {
        return DESCRIZIONE_FINTA;
      },
      //  Solo il capofila porta i sender veri del `pub` (e mai quelli di un pc chiuso o vecchio:
      //  `pub` punta sempre al pc corrente, e durante la ricostruzione è null).
      getSenders: () => (capofila() === pid && !voce.chiuso && pub ? pub.pc.getSenders() : []),
      async getStats() {
        const [p, s] = await Promise.all([
          pub ? pub.pc.getStats().catch(() => null) : null,
          sub ? sub.pc.getStats().catch(() => null) : null,
        ]);
        return unisciRapporti({
          capofila: capofila() === pid && !voce.chiuso,
          pub: p,
          sub: s,
          eMia: (i) => eMiaTraccia(pid, i),
        }) as unknown as RTCStatsReport;
      },
      close: () => {
        chiudiVoce(voce);
        ricalcolaTutti();
      },
      restartIce: () => riprova(pid, true),
      setConfiguration: () => {},
      createOffer: async () => {
        throw new Error("non supportato in SFU");
      },
      createAnswer: async () => {
        throw new Error("non supportato in SFU");
      },
      setLocalDescription: async () => {
        throw new Error("non supportato in SFU");
      },
      setRemoteDescription: async () => {
        throw new Error("non supportato in SFU");
      },
      addIceCandidate: async () => {
        throw new Error("non supportato in SFU");
      },
    };
    const voce: Voce = {
      pid,
      chiuso: false,
      ultimo: "new",
      facciata: facciata as unknown as RTCPeerConnection,
    };
    voci.set(pid, voce);
    voce.ultimo = calcola(voce);
    return voce.facciata;
  }

  /* ── L'INTERFACCIA ───────────────────────────────────────────────────── */

  function riprova(pid: string, _ancheSeConnessa?: boolean) {
    if (chiuso || fallito) return;
    const v = voci.get(pid);
    if (!v || v.chiuso) return;
    //  Cloudflare non ha l'ICE restart: un pc guasto si ricostruisce (una volta per guasto).
    const pubGuasto = pcGuasto(pub);
    const subGuasto = pcGuasto(sub);
    if (pubGuasto) guasto("pub");
    if (subGuasto) guasto("sub");
    if (pubGuasto || subGuasto) return;
    //  Pc sani: se il pid non saluta se n'è andato (niente); se saluta ma è muto, si riabbona lui.
    if (!completo(pid) && sottoscritti.has(pid) && !inCoda.has(pid)) riabbonaSePuoi(pid);
  }

  const trasporto: TrasportoSfu = {
    avvia(l) {
      if (chiuso) return;
      local = l;
      avviaTick();
      vaiAvanti();
    },
    sincronizza() {
      vaiAvanti();
    },
    annuncio: () => (annuncioCorrente ? { ...annuncioCorrente } : null),
    suAnnuncio(pid, a) {
      if (chiuso || !pidValido(pid) || pid === mioPid || !a || typeof a.s !== "string" || !a.s)
        return;
      const nomi = nomiTracce(pid);
      if ((a.a && a.a !== nomi.audio) || (a.v && a.v !== nomi.video) || (!a.a && !a.v)) return;
      const nuovo: AnnuncioSfu = { s: a.s, a: a.a || "", v: a.v || "" };
      const prima = annunci.get(pid);
      //  Idempotente per annuncio: l'`hello` lo ripete ogni 3 s.
      if (prima && chiaveAnnuncio(prima) === chiaveAnnuncio(nuovo)) return;
      annunci.set(pid, nuovo);
      //  Ha ripubblicato (ricostruzione, ricarica): le sue vecchie m-line sono morte e si riabbona.
      if (prima) riabbona(pid);
      else vaiAvanti();
    },
    viva(pid) {
      saluti.set(pid, adesso());
      ricalcolaTutti();
    },
    nuovoPeer,
    async sostituisci(kind, t) {
      ultima[kind] = t;
      if (chiuso || !pub) return;
      const s = pub.sender[kind];
      if (s) {
        try {
          await s.replaceTrack(t);
        } catch {
          log("sostituzione traccia non riuscita");
        }
      } else if (t) {
        vaiAvanti();
      }
    },
    riprova,
    espelli(pid) {
      void chiedi("espelli", { codice, pid });
      const v = voci.get(pid);
      if (v) {
        chiudiVoce(v);
        ricalcolaTutti();
      }
    },
    chiudiTutto() {
      if (chiuso) return;
      chiuso = true;
      for (const f of [...risvegli]) f();
      risvegli.clear();
      for (const f of [...sveglie]) f();
      sveglie.clear();
      fermaTick?.();
      fermaTick = null;
      for (const v of [...voci.values()]) chiudiVoce(v);
      chiudiLato(pub);
      chiudiLato(sub);
      pub = null;
      sub = null;
      annuncioCorrente = null;
      //  ⚠️ Anche a uscita forzata: la riga sul server non deve restare viva 3 minuti. `keepalive`
      //   perché la scheda può chiudersi un attimo dopo.
      if (chiave)
        void chiama("esci", { codice, pid: mioPid, chiave }, { keepalive: true }).catch(() => {});
      if (
        typeof window !== "undefined" &&
        (window as unknown as { __hgSfu?: unknown }).__hgSfu === gancioDev
      )
        delete (window as unknown as { __hgSfu?: unknown }).__hgSfu;
    },
    stato: () => ({
      pub: pub ? pub.pc.connectionState : "new",
      sub: sub ? sub.pc.connectionState : "new",
      annunciati: annunci.size,
      ricostruzioni: ricostruzioniFatte,
    }),
    onFallito(cb) {
      cbFallito = cb;
    },
    onAnnuncio(cb) {
      cbAnnuncio = cb;
    },
  };

  /** Solo in sviluppo: per provare a mano le cadute (scenario S-9 del collaudo). */
  const gancioDev = {
    stato: () => trasporto.stato(),
    simulaCaduta: (quale: "pub" | "sub") => guasto(quale),
    forzaRiabbona: (pid: string) => riabbona(pid),
  };
  if (typeof window !== "undefined" && import.meta.env?.DEV)
    (window as unknown as { __hgSfu?: unknown }).__hgSfu = gancioDev;

  return trasporto;
}
