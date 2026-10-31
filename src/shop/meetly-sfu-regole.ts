/** ── MEETLY · I MEDIA DALL'SFU DI CLOUDFLARE: LE REGOLE PURE ────────────────
 *
 *  Commessa 2026-10-31-meetly-connessione, Parte B (piano v2 + note N1-N5).
 *
 *  ── PERCHÉ ESISTE ────────────────────────────────────────────────────────
 *  Alcuni clienti entrano nella stanza e si vedono «dentro» a vicenda, ma
 *  ognuno vede l'altro con camera e microfono spenti: la presenza viaggia sul
 *  canale Supabase, il media su una connessione per coppia che non si forma.
 *  Con l'SFU ognuno pubblica le sue tracce su Cloudflare e si abbona a quelle
 *  degli altri; presenza e «chi c'è / quali tracce» restano sul canale di oggi.
 *  Tutto dietro un interruttore (`app_config.meetly_trasporto`), spento di
 *  serie: con «mesh» la chiamata è quella di sempre.
 *
 *  ── COSA C'È QUI ─────────────────────────────────────────────────────────
 *  Solo regole che non toccano né rete né browser, così girano in Node dentro
 *  `npm test` (prove/idee/meetly-sfu-regole.mjs): tipi e costanti condivisi
 *  dagli altri quattro file della Parte B, il formato dei nomi delle tracce,
 *  la scelta del trasporto, l'accordo fra consulente e ospite, lo stato di un
 *  partecipante, la decisione di ripresa, il rapporto `getStats` unito e chi
 *  può abbonarsi a cosa. L'orologio arriva SEMPRE da fuori (`adesso`): niente
 *  `Date.now`, niente effetti all'import.
 *
 *  ── ⚠️ DUE COSE CHE SI SBAGLIANO FACILMENTE ──────────────────────────────
 *   · «connected» qui NON vuol dire «il pc verso Cloudflare va», vuol dire «la
 *     PERSONA è raggiungibile» (`statoPeer`): se un partecipante chiude la
 *     scheda senza salutare il suo flusso resta vivo sul server, e senza
 *     questa regola il riquadro resterebbe fantasma per sempre (è il bug del
 *     13/10 «quando una persona esce resta dentro»).
 *   · Un solo verso: mesh → SFU solo all'ingresso, SFU → mesh quando serve, mai
 *     il ritorno nella stessa chiamata (`adottaTrasporto`), altrimenti due lati
 *     che si vedono male si rimbalzano per sempre.
 *  ───────────────────────────────────────────────────────────────────────── */

/* ── TIPI E INTERFACCIA DEL CLIENT (congelata: T3 la realizza, T5 la usa) ── */

export type Trasporto = "mesh" | "sfu";

/** Cosa un partecipante annuncia nell'`hello` dopo aver pubblicato:
 *  la sessione `pub` e i nomi delle sue tracce (`v` vuoto = senza video). */
export interface AnnuncioSfu {
  s: string;
  a: string;
  v: string;
}

/** Perché si torna a mesh (§2.5). */
export type MotivoRipiego =
  | "server"
  | "timeout-pub"
  | "timeout-sub"
  | "ice-fallita"
  | "ospite-vecchio"
  | "ospite"
  | "non-configurato";

export interface TrasportoSfu {
  /** Idempotente; pubblica solo se c'è almeno un altro. */
  avvia(local: MediaStream): void;
  /** Media arrivati dopo, nuovi pid; ripubblica se manca un tipo (NON conta nel budget). */
  sincronizza(): void;
  annuncio(): AnnuncioSfu | null;
  /** Idempotente per (pid, sessionId). */
  suAnnuncio(pid: string, a: AnnuncioSfu): void;
  /** Da ogni hello: alimenta `statoPeer`. */
  viva(pid: string): void;
  nuovoPeer(pid: string): RTCPeerConnection;
  /** Ricorda l'ultima traccia per tipo (serve alla ricostruzione). */
  sostituisci(kind: "audio" | "video", t: MediaStreamTrack | null): Promise<void>;
  riprova(pid: string, ancheSeConnessa?: boolean): void;
  espelli(pid: string): void;
  chiudiTutto(): void;
  stato(): { pub: string; sub: string; annunciati: number; ricostruzioni: number };
  onFallito(cb: (m: MotivoRipiego) => void): void;
  onAnnuncio(cb: () => void): void;
}

/* ── COSTANTI (una per numero: chi le cambia lo fa qui) ───────────────── */

/** Lo stato di un `RTCPeerConnection`, come lo dice il browser. */
export type StatoPc = "new" | "connecting" | "connected" | "disconnected" | "failed" | "closed";

/** Silenzio (nessun `hello`, che arriva ogni 3 s da un Worker) dopo cui il
 *  partecipante risulta `disconnected`: quattro saluti persi.
 *  ⚠️ Stanno SOTTO il taglio dall'elenco (`SALUTO_VIVO_MS` = 30 s in
 *   `shop/resta-in-lista`: lo si prova): `failed` arriva cinque secondi prima,
 *   quindi non accorcia niente e non allunga niente. */
export const DISCONNESSO_DOPO_MS = 12_000;
/** …e dopo cui risulta `failed`: otto saluti persi. */
export const FALLITO_DOPO_MS = 25_000;
/** Un pc `disconnected` che si riprende da solo in pochi secondi non è una
 *  caduta: finché dura la grazia lo stato resta `connecting`.
 *  shortcut: cinque secondi scelti, non misurati; si cambia se il collaudo
 *  (S-9) mostra riquadri che lampeggiano. */
export const GRAZIA_PC_DISCONNESSO_MS = 5_000;

/** L'ospite adotta l'SFU all'ingresso soltanto: i primi secondi dal primo
 *  `hello` del consulente (N1). */
export const FINESTRA_INGRESSO_MS = 10_000;
/** Un nuovo pid del consulente (ha ricaricato la scheda) senza `tr:"sfu"`:
 *  l'ospite resta com'è per tanto, poi passa a mesh (N3). */
export const ATTESA_NUOVO_HOST_MS = 8_000;
/** Lettura dell'interruttore all'avvio, in parallelo a permessi e camera (N4). */
export const LETTURA_INTERRUTTORE_MS = 1_500;

/** Ripiego (§2.5). */
export const TIMEOUT_SERVER_MS = 8_000;
export const TIMEOUT_PUB_MS = 12_000;
export const TIMEOUT_SUB_MS = 15_000;
/** L'ospite che trova 403 `non-ammesso`, 409 o 429 ritenta per tanto prima di
 *  ripiegare (N2): la decisione del consulente arriva al server con un
 *  ritentativo a 2 s o dal giro di 8 s della sala d'attesa. */
export const ATTESA_OSPITE_MS = 20_000;
export const RITENTA_OGNI_MS = 1_500;

/** Ripresa (§1.7): al massimo 3 ricostruzioni in 5 minuti, poi `ice-fallita`. */
export const RICOSTRUZIONI_MAX = 3;
export const FINESTRA_RICOSTRUZIONI_MS = 300_000;
/** Riabbonare un pid muto: al massimo 2 al minuto. */
export const RIABBONA_MAX = 2;
export const FINESTRA_RIABBONA_MS = 60_000;
/** Senza `tracks/close` le m-line del `sub` crescono a ogni ricarica di
 *  chiunque: oltre queste si ricostruisce il solo `sub`, senza budget. */
export const MLINE_MORTE_MAX = 12;

/** Limiti della rotta (§1.5). */
export const MAX_CORPO_BYTE = 96 * 1024;
export const MAX_RIGHE_VIVE = 8;
export const MAX_PUBBLICA_PID = 6;
export const FINESTRA_PUBBLICA_PID_MS = 600_000;
export const MAX_PUBBLICA_CODICE = 40;
export const FINESTRA_PUBBLICA_CODICE_MS = 3_600_000;
export const MAX_TRACCE_ABBONATI = 8;
export const MAX_ABBONATI_MINUTO = 30;
/** Una riga di partecipante è «viva» se ha avuto un'azione negli ultimi 3
 *  minuti; il client manda `rinnova` ogni minuto. Le righe morte non contano
 *  nei tetti (ogni ricarica crea un pid nuovo e il `bye` può perdersi). */
export const RIGA_VIVA_MS = 180_000;
export const RINNOVA_OGNI_MS = 60_000;

/** Tetto del video in SFU: ogni destinatario riceve lo STESSO flusso, senza
 *  livelli, e non si sa come Cloudflare tratti un abbonato lento. Finché non si
 *  sa, il listino non supera quello di «med» (vale anche per lo schermo: per
 *  una presentazione animata è poco, per un testo fermo basta).
 *  ⚠️ Copia di `QUALITY.med.br` di call.tsx: la prova li confronta. */
export const TETTO_SFU_BPS = 1_400_000;
export const tettoSfu = (): number => TETTO_SFU_BPS;

/* ── PID E NOMI DELLE TRACCE ──────────────────────────────────────────── */

/** I pid di call.tsx (`genPid`) sono 8 caratteri base 36: qui si accetta da 4 a 16. */
const PID_RE = /^[a-z0-9]{4,16}$/;
const TRACCIA_RE = /^([a-z0-9]{4,16})-([av])$/;

export const pidValido = (pid: unknown): pid is string => typeof pid === "string" && PID_RE.test(pid);

/** I nomi con cui un partecipante pubblica: `<pid>-a` (audio), `<pid>-v` (video).
 *  Lancia su un pid fuori formato: un nome sbagliato qui finirebbe sul server. */
export function nomiTracce(pid: string): { audio: string; video: string } {
  if (!pidValido(pid)) throw new Error("pid non valido");
  return { audio: `${pid}-a`, video: `${pid}-v` };
}

export function pidDaNomeTraccia(nome: unknown): { pid: string; kind: "audio" | "video" } | null {
  const m = typeof nome === "string" ? TRACCIA_RE.exec(nome) : null;
  return m ? { pid: m[1], kind: m[2] === "a" ? "audio" : "video" } : null;
}

/* ── CHE TRASPORTO SI USA (§2.3) ──────────────────────────────────────── */

/** La riga `app_config.meetly_trasporto`: assente, vuota o illeggibile = mesh. */
export function trasportoDaConfig(valore: unknown): Trasporto {
  let v: any = valore;
  if (typeof v === "string") {
    try {
      v = JSON.parse(v);
    } catch {
      return "mesh";
    }
  }
  return v?.trasporto === "sfu" ? "sfu" : "mesh";
}

export type MotivoScelta =
  | "ospite"
  | "link-mesh"
  | "link-sfu"
  | "link-sfu-senza-segreti"
  | "segno-ripiego"
  | "interruttore"
  | "interruttore-senza-segreti"
  | "default";

/** Decide il consulente, una volta, all'avvio. Il primo che vale:
 *   1. `?trasporto=mesh` nel suo link → mesh;
 *   2. `?trasporto=sfu` → sfu se i segreti Meetly ci sono (`pronto`), altrimenti
 *      mesh; in entrambi i casi il segno di ripiego si cancella;
 *   3. segno di ripiego (`hg_tr_<codice>=mesh`, 30 minuti) → mesh;
 *   4. interruttore `sfu` e `pronto` → sfu;
 *   5. mesh.
 *  ⚠️ L'ESPLICITO BATTE IL SEGNO: chi prova, fallisce una volta e riprova col
 *   link giusto non deve restare in mesh senza saperlo. L'OSPITE non decide:
 *   il suo `?trasporto` è ignorato, parte in mesh e poi obbedisce (`adottaTrasporto`).
 *  `cancellaSegno` dice a chi chiama di togliere il segno dalla `sessionStorage`. */
export function sceltaTrasporto(x: {
  ruolo: "consulente" | "ospite";
  paramLink?: string | null;
  segnoRipiego?: boolean;
  interruttore?: Trasporto | null;
  pronto?: boolean;
}): { trasporto: Trasporto; motivo: MotivoScelta; cancellaSegno: boolean } {
  if (x.ruolo !== "consulente") return { trasporto: "mesh", motivo: "ospite", cancellaSegno: false };
  const p = String(x.paramLink ?? "").trim().toLowerCase();
  if (p === "mesh") return { trasporto: "mesh", motivo: "link-mesh", cancellaSegno: false };
  if (p === "sfu") {
    return x.pronto
      ? { trasporto: "sfu", motivo: "link-sfu", cancellaSegno: true }
      : { trasporto: "mesh", motivo: "link-sfu-senza-segreti", cancellaSegno: true };
  }
  if (x.segnoRipiego) return { trasporto: "mesh", motivo: "segno-ripiego", cancellaSegno: false };
  if (x.interruttore === "sfu") {
    return x.pronto
      ? { trasporto: "sfu", motivo: "interruttore", cancellaSegno: false }
      : { trasporto: "mesh", motivo: "interruttore-senza-segreti", cancellaSegno: false };
  }
  return { trasporto: "mesh", motivo: "default", cancellaSegno: false };
}

/* ── COME I DUE LATI SI METTONO D'ACCORDO (§2.4, N1, N3) ──────────────── */

/** Cosa l'OSPITE sa del trasporto. Lo tiene call.tsx e lo passa a ogni `hello`
 *  del consulente; la funzione non cambia mai l'oggetto che riceve. */
export interface StatoAdozione {
  trasporto: Trasporto;
  /** Il pid del consulente come l'ospite lo conosce (null = non ancora visto). */
  hostPid: string | null;
  /** Istante del primo `hello` di un consulente (0 = mai): apre la finestra d'ingresso. */
  primoHello: number;
  /** L'ospite è già tornato a mesh in questa chiamata: non riadotta mai l'SFU. */
  ripiegoFatto: boolean;
  /** Da quando è comparso l'ultimo pid del consulente diverso dal primo (0 = nessuno in attesa). */
  hostNuovoDa: number;
}

export const nuovoStatoAdozione = (): StatoAdozione => ({
  trasporto: "mesh",
  hostPid: null,
  primoHello: 0,
  ripiegoFatto: false,
  hostNuovoDa: 0,
});

/** Chi ripiega da sé (per rete, `ripiegaSuMesh`) lo registra qui: da quel
 *  momento `tr:"sfu"` non conta più. */
export const dopoRipiegoLocale = (s: StatoAdozione): StatoAdozione => ({ ...s, trasporto: "mesh", ripiegoFatto: true });

export type EsitoAdozione = {
  azione: "resta" | "sfu" | "mesh";
  motivo: string;
  stato: StatoAdozione;
};

/** Da chiamare a ogni `hello` di un partecipante con `role:"host"`.
 *   · mesh → SFU: solo se `tr:"sfu"`, l'ospite non ha mai ripiegato, siamo nei
 *     primi `FINESTRA_INGRESSO_MS` dal primo hello del consulente e nessun pc è
 *     già `connected` (N1: senza questi paletti l'ospite rimbalza per sempre tra
 *     un ripiego e la riadozione);
 *   · SFU → mesh: `tr:"mesh"` (il consulente ha ripiegato) → ripiego locale;
 *   · pid nuovo del consulente (ricarica della scheda, N3): per
 *     `ATTESA_NUOVO_HOST_MS` si resta com'è e il suo `tr` non conta (un
 *     estraneo sul canale non autenticato non può far ripiegare con un solo
 *     `hello`); se in quel tempo non arriva `tr:"sfu"` passa a mesh (l'interruttore
 *     è stato girato nel frattempo e non lo dirà nessuno).
 *  `tr` assente da un consulente noto: si resta com'è. */
export function adottaTrasporto(
  s: StatoAdozione,
  h: { pid: string; tr?: unknown },
  ctx: { adesso: number; nessunPcConnesso: boolean },
): EsitoAdozione {
  const { adesso } = ctx;
  const tr: Trasporto | undefined = h.tr === "sfu" || h.tr === "mesh" ? h.tr : undefined;
  const st: StatoAdozione = { ...s };
  if (st.hostPid === null) {
    st.hostPid = h.pid;
    st.primoHello = adesso;
    st.hostNuovoDa = 0;
  } else if (h.pid !== st.hostPid) {
    st.hostPid = h.pid;
    st.hostNuovoDa = adesso;
  }
  const inAttesa = st.hostNuovoDa !== 0;
  const maturo = !inAttesa || adesso - st.hostNuovoDa >= ATTESA_NUOVO_HOST_MS;

  if (st.trasporto === "sfu") {
    if (tr === "sfu") {
      st.hostNuovoDa = 0;
      return { azione: "resta", motivo: "tr-sfu", stato: st };
    }
    if (tr === "mesh" && maturo) {
      return { azione: "mesh", motivo: "tr-mesh", stato: dopoRipiegoLocale(st) };
    }
    if (tr === undefined && inAttesa && maturo) {
      return { azione: "mesh", motivo: "host-nuovo-senza-tr", stato: dopoRipiegoLocale(st) };
    }
    return { azione: "resta", motivo: inAttesa ? "host-nuovo" : "tr-assente", stato: st };
  }

  if (tr !== "sfu") return { azione: "resta", motivo: "mesh", stato: st };
  if (st.ripiegoFatto) return { azione: "resta", motivo: "gia-ripiegato", stato: st };
  if (adesso - st.primoHello > FINESTRA_INGRESSO_MS) return { azione: "resta", motivo: "fuori-finestra", stato: st };
  if (!ctx.nessunPcConnesso) return { azione: "resta", motivo: "pc-connesso", stato: st };
  return { azione: "sfu", motivo: "tr-sfu", stato: { ...st, trasporto: "sfu", hostNuovoDa: 0 } };
}

/* ── LA PERSONA C'È ANCORA? (§1.3) ────────────────────────────────────── */

/** Il `connectionState` del PeerSfu di UN partecipante.
 *   · `closed` dopo `close()`;
 *   · `failed` se `pub` o `sub` sono falliti, o se da quel pid non arriva un
 *     `hello` da più di `FALLITO_DOPO_MS`;
 *   · `disconnected` se uno dei due pc è `disconnected` oltre la grazia, o se
 *     manca il saluto da più di `DISCONNESSO_DOPO_MS`;
 *   · `connected` solo se `pub` e `sub` sono su, le tracce di QUEL pid sono
 *     arrivate (`tracce`: tutte quelle che ha annunciato) e ha salutato di recente;
 *   · altrimenti `connecting` (o `new` se nessuno dei due pc è partito).
 *  `ultimoSaluto` = 0 vuol dire mai salutato: non può essere `connected`. */
export function statoPeer(x: {
  adesso: number;
  chiuso: boolean;
  pub: StatoPc;
  sub: StatoPc;
  /** Da quando uno dei due pc è `disconnected` (0 = non lo so / non lo è). */
  disconnessoDa: number;
  tracce: boolean;
  ultimoSaluto: number;
}): StatoPc {
  if (x.chiuso) return "closed";
  const silenzio = x.ultimoSaluto > 0 ? x.adesso - x.ultimoSaluto : 0;
  if (x.pub === "failed" || x.sub === "failed" || silenzio > FALLITO_DOPO_MS) return "failed";
  const pcGiu = x.pub === "disconnected" || x.sub === "disconnected";
  if (silenzio > DISCONNESSO_DOPO_MS) return "disconnected";
  if (pcGiu && (x.disconnessoDa <= 0 || x.adesso - x.disconnessoDa >= GRAZIA_PC_DISCONNESSO_MS)) return "disconnected";
  if (x.pub === "connected" && x.sub === "connected" && x.tracce && x.ultimoSaluto > 0 && !pcGiu) return "connected";
  return x.pub === "new" && x.sub === "new" ? "new" : "connecting";
}

/* ── RIPRESA: RICOSTRUIRE, RIABBONARE, RIPIEGARE (§1.7) ───────────────── */

/** Cosa il client ricorda per decidere. Un guasto del `sub` fa scattare
 *  l'evento su OGNI PeerSfu (stesso pc condiviso): per questo `inVolo` — la
 *  prima richiesta parte, le altre si fondono. */
export interface StatoRipresa {
  /** Istanti delle ricostruzioni COMPLETATE che non hanno risolto il guasto. */
  ricostruzioni: number[];
  /** Una ricostruzione in corso; "conta" = se il guasto persiste va nel budget. */
  inVolo: { pub: false | "conta" | "libera"; sub: false | "conta" | "libera" };
  /** Istanti dei riabbonamenti per pid. */
  riabbona: Record<string, number[]>;
}

export const nuovoStatoRipresa = (): StatoRipresa => ({
  ricostruzioni: [],
  inVolo: { pub: false, sub: false },
  riabbona: {},
});

export interface RichiestaRipresa {
  adesso: number;
  /** pub/sub: un guasto del pc · pid-muto: i pc sono sani ma UN pid non manda
   *  niente · tipo-arrivato: è arrivato un tipo di traccia che mancava (permesso
   *  concesso dopo l'ingresso) · mline-morte: troppe m-line morte nel `sub`. */
  tipo: "pub" | "sub" | "pid-muto" | "tipo-arrivato" | "mline-morte";
  pid?: string;
  pidHaSalutato?: boolean;
  mlineMorte?: number;
}

export interface EsitoRipresa {
  azione: "niente" | "riabbona" | "ricostruisci" | "ripiega";
  quale?: "pub" | "sub";
  pid?: string;
  motivo: string;
  /** Per `ricostruisci`: se il guasto persiste dopo, va nel budget. */
  contaSePersiste: boolean;
  stato: StatoRipresa;
}

const recenti = (xs: number[], adesso: number, finestra: number) => xs.filter((t) => adesso - t <= finestra);

/** Cosa fare davanti a una richiesta di ripresa. Non muta lo stato: ne ritorna uno nuovo.
 *   · idempotente per guasto: se la ricostruzione di quel pc è già in volo, niente;
 *   · pub/sub: ricostruisci, finché le ricostruzioni COMPLETATE con guasto
 *     persistito negli ultimi 5 minuti sono meno di 3; poi `ripiega` (`ice-fallita`);
 *   · pid muto con pc sani: SOLO riabbonare quel pid (max 2 al minuto), mai ripiego;
 *     se manca il suo saluto la persona se n'è andata: niente;
 *   · tipo arrivato dopo e m-line morte: ricostruisci, fuori dal budget. */
export function decidiRipresa(s: StatoRipresa, r: RichiestaRipresa): EsitoRipresa {
  const st: StatoRipresa = {
    ricostruzioni: recenti(s.ricostruzioni, r.adesso, FINESTRA_RICOSTRUZIONI_MS),
    inVolo: { ...s.inVolo },
    riabbona: { ...s.riabbona },
  };
  const niente = (motivo: string): EsitoRipresa => ({ azione: "niente", motivo, contaSePersiste: false, stato: st });
  const ricostruisci = (quale: "pub" | "sub", conta: boolean, motivo: string): EsitoRipresa => {
    st.inVolo[quale] = conta ? "conta" : "libera";
    return { azione: "ricostruisci", quale, motivo, contaSePersiste: conta, stato: st };
  };

  if (r.tipo === "pid-muto") {
    if (!r.pid) return niente("senza-pid");
    if (!r.pidHaSalutato) return niente("senza-saluto");
    const fatti = recenti(st.riabbona[r.pid] || [], r.adesso, FINESTRA_RIABBONA_MS);
    if (fatti.length >= RIABBONA_MAX) {
      st.riabbona[r.pid] = fatti;
      return niente("limite-riabbona");
    }
    st.riabbona[r.pid] = [...fatti, r.adesso];
    return { azione: "riabbona", pid: r.pid, motivo: "pid-muto", contaSePersiste: false, stato: st };
  }
  if (r.tipo === "tipo-arrivato") {
    return st.inVolo.pub ? niente("in-volo") : ricostruisci("pub", false, "tipo-arrivato");
  }
  if (r.tipo === "mline-morte") {
    if ((r.mlineMorte ?? 0) <= MLINE_MORTE_MAX) return niente("sotto-soglia");
    return st.inVolo.sub ? niente("in-volo") : ricostruisci("sub", false, "mline-morte");
  }
  if (st.inVolo[r.tipo]) return niente("in-volo");
  if (st.ricostruzioni.length >= RICOSTRUZIONI_MAX) {
    return { azione: "ripiega", motivo: "ice-fallita", contaSePersiste: false, stato: st };
  }
  return ricostruisci(r.tipo, true, "guasto");
}

/** La ricostruzione è finita. `persistito`: dopo averla fatta il guasto c'è
 *  ancora. Solo le ricostruzioni nate come «conta» e persistite entrano nel budget. */
export function finisciRicostruzione(s: StatoRipresa, quale: "pub" | "sub", adesso: number, persistito: boolean): StatoRipresa {
  const conta = s.inVolo[quale] === "conta" && persistito;
  return {
    ...s,
    ricostruzioni: [...recenti(s.ricostruzioni, adesso, FINESTRA_RICOSTRUZIONI_MS), ...(conta ? [adesso] : [])],
    inVolo: { ...s.inVolo, [quale]: false },
  };
}

/* ── IL RAPPORTO getStats DEL PeerSfu (§1.3) ──────────────────────────── */

type RapportoGrezzo = { forEach(cb: (voce: any, id: string) => void): void };

/** Dietro ogni PeerSfu ci sono due pc (`pub`, `sub`) condivisi da tutti gli
 *  altri partecipanti, ma il resto di call.tsx chiama `getStats()` su OGNI
 *  peer e somma. Per non contare due volte:
 *   · ogni PeerSfu porta degli `inbound-rtp` SOLO quelli delle sue tracce
 *     (`eMia`): i download di tutti si sommano, una volta;
 *   · il `capofila` porta in più il resto: uscita e coppie di candidati di
 *     `pub` e `sub` (banda, giro, perdite «su» per l'indicatore di linea);
 *   · ⚠️ i `bytesReceived` delle coppie sono azzerati: contano STUN e RTCP, e
 *     `sampleUsage` (`recv = pairRecv || rtpRecv`) prenderebbe quelli al posto
 *     degli `inbound-rtp` dei soli media. Così il consumo totale è lo stesso
 *     con qualunque capofila;
 *   · gli id si prefissano `pub:`/`sub:` perché i due pc possono darne di
 *     uguali, e i riferimenti (`localCandidateId`, `transportId`…) si riscrivono.
 *  Si ritorna una `Map`: ha `forEach(valore, id)` e `get` come `RTCStatsReport`.
 *  I rapporti di partenza non vengono toccati. */
export function unisciRapporti(x: {
  capofila: boolean;
  pub: RapportoGrezzo | null;
  sub: RapportoGrezzo | null;
  eMia: (inbound: any) => boolean;
}): Map<string, any> {
  const fuori = new Map<string, any>();
  for (const [prefisso, rapporto] of [["pub", x.pub], ["sub", x.sub]] as const) {
    rapporto?.forEach((v: any) => {
      const inbound = v.type === "inbound-rtp";
      if (inbound ? !x.eMia(v) : !x.capofila) return;
      const copia: any = { ...v, id: `${prefisso}:${v.id}` };
      for (const k of Object.keys(copia)) {
        if (k !== "id" && k.endsWith("Id") && typeof copia[k] === "string") copia[k] = `${prefisso}:${copia[k]}`;
      }
      if (v.type === "candidate-pair") copia.bytesReceived = 0;
      fuori.set(copia.id, copia);
    });
  }
  return fuori;
}

/* ── CHI PUÒ ABBONARSI A COSA (§1.5) ──────────────────────────────────── */

/** La riga di un partecipante (`app_config` `meetly_sfu:<codice>:<pid>`), nei
 *  soli campi che servono a decidere. */
export interface RigaStanza {
  pid: string;
  /** Ultima azione. */
  at: number;
  pubSessionId: string;
  audio: string;
  video: string;
}

export const righeVive = <T extends { at: number }>(righe: T[], adesso: number): T[] =>
  righe.filter((r) => adesso - Number(r.at) <= RIGA_VIVA_MS);

export type MotivoNoAbbonamento = "nessuna" | "troppe" | "nome" | "propria" | "sessione" | "non-viva" | "traccia";

/** Può `pid` abbonarsi a queste tracce? `righe` sono SOLO quelle di questa
 *  stanza: una sessione che non vi compare (altra stanza, inventata) è rifiutata.
 *  Ogni traccia deve avere un nome `<pid>-a|v`, essere di un altro, stare in una
 *  riga VIVA con quella sessione e con quel nome pubblicato. Basta una cattiva
 *  per rifiutare tutta la richiesta. */
export function puoAbbonarsi(x: {
  adesso: number;
  pid: string;
  righe: RigaStanza[];
  tracce: unknown;
}): { ok: true } | { ok: false; motivo: MotivoNoAbbonamento } {
  const no = (motivo: MotivoNoAbbonamento) => ({ ok: false as const, motivo });
  if (!Array.isArray(x.tracce) || x.tracce.length === 0) return no("nessuna");
  if (x.tracce.length > MAX_TRACCE_ABBONATI) return no("troppe");
  for (const t of x.tracce) {
    const n = pidDaNomeTraccia(t?.trackName);
    if (!n) return no("nome");
    if (n.pid === x.pid) return no("propria");
    const riga = x.righe.find((r) => r.pid === n.pid);
    if (!riga || riga.pubSessionId !== t.sessionId) return no("sessione");
    if (x.adesso - Number(riga.at) > RIGA_VIVA_MS) return no("non-viva");
    if ((n.kind === "audio" ? riga.audio : riga.video) !== t.trackName) return no("traccia");
  }
  return { ok: true };
}
