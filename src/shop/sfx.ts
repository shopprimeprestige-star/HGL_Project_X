// ── SUONI DELL'APPLICAZIONE ─────────────────────────────────────────────────
//  Tutti i suoni nascono qui, sintetizzati sul momento: nessun file da scaricare,
//  nessun ritardo, e il timbro è lo stesso ovunque.
//
//  IL CRITERIO, che vale per tutti:
//   · onde SINUSOIDALI con qualche armonica, mai onde quadre o a dente di sega:
//     è la differenza fra una campana e un cicalino;
//   · attacco morbido (qualche millesimo) e coda esponenziale lunga: i suoni
//     secchi sembrano di plastica, quelli con la coda sembrano strumenti;
//   · un velo di riverbero generato internamente, cortissimo: dà l'impressione
//     che il suono accada in una stanza vera e non dentro l'altoparlante;
//   · intervalli musicali consonanti (quinte, terze maggiori) accordati su una
//     scala sola, così due suoni ravvicinati non stonano mai fra loro.
//
//  I suoni dell'interfaccia (campo, opzione, slide, modalità) sono volutamente
//  BREVISSIMI e sottovoce: si devono sentire, non ascoltare. Solo i due eventi
//  che riguardano le persone — qualcuno bussa, qualcuno è entrato — hanno
//  volume pieno e una coda che si nota.

type Voice = { freq: number; at?: number; dur?: number; gain?: number; type?: OscillatorType };

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let verb: ConvolverNode | null = null;
let verbSend: GainNode | null = null;
let lastAt = 0;

const PREF = "hg_sfx";           // "off" per silenziare tutto
const isOff = () => { try { return localStorage.getItem(PREF) === "off"; } catch { return false; } };

/** Accende o spegne i suoni dell'applicazione. */
export function setSfxEnabled(on: boolean) {
  try { localStorage.setItem(PREF, on ? "on" : "off"); } catch { /* */ }
}
export function sfxEnabled(): boolean { return !isOff(); }

/** Coda di riverbero generata a mano: mezzo secondo di rumore che si spegne. */
function makeVerb(c: AudioContext): ConvolverNode {
  const len = Math.floor(c.sampleRate * 0.5);
  const buf = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      // rumore che decade: più lontano nel tempo, più piano
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6) * 0.55;
    }
  }
  const cv = c.createConvolver();
  cv.buffer = buf;
  return cv;
}

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    //  Un contesto chiuso non si riapre: se capita, si riparte da zero invece
    //  di restare muti per il resto della sessione.
    if (ctx && (ctx.state as string) === "closed") { ctx = null; master = null; verb = null; verbSend = null; }
    if (!ctx) {
      // Si riusa il contesto condiviso di Meetly: aprirne uno solo per
      // i suoni dell'interfaccia significava un thread audio in più in tempo
      // reale, proprio mentre la voce sta già lavorando.
      const cond = (window as unknown as { __hgAudioCtx?: AudioContext }).__hgAudioCtx;
      if (cond && (cond.state as string) !== "closed") { ctx = cond; }
      else {
      const Ctx = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
        .AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return null;
      ctx = new Ctx();
      (window as unknown as { __hgAudioCtx?: AudioContext }).__hgAudioCtx = ctx;
      }
      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(ctx.destination);
      verb = makeVerb(ctx);
      verbSend = ctx.createGain();
      verbSend.gain.value = 0.16;      // appena percettibile
      verbSend.connect(verb);
      verb.connect(master);
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch { return null; }
}

/** Da chiamare al primo tocco/clic dell'utente: i browser non fanno suonare
 *  nulla finché non c'è stato un gesto. */
export function primeSfx() { audio(); }

/** Una nota: sinusoide con seconda armonica, inviluppo morbido, un filo di riverbero. */
function nota(c: AudioContext, v: Voice, vol: number) {
  const t0 = c.currentTime + (v.at ?? 0);
  const dur = v.dur ?? 0.5;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, (v.gain ?? 1) * vol), t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  const o = c.createOscillator();
  o.type = v.type ?? "sine";
  o.frequency.setValueAtTime(v.freq, t0);
  o.connect(g);

  // armonica di ottava, molto più piano: è ciò che dà il "corpo" da campana
  const o2 = c.createOscillator();
  const g2 = c.createGain();
  o2.type = "sine";
  o2.frequency.setValueAtTime(v.freq * 2.01, t0);   // 2.01: battimento lentissimo, suona vivo
  g2.gain.setValueAtTime(0.0001, t0);
  g2.gain.exponentialRampToValueAtTime(Math.max(0.0002, (v.gain ?? 1) * vol * 0.22), t0 + 0.012);
  g2.gain.exponentialRampToValueAtTime(0.0001, t0 + dur * 0.6);
  o2.connect(g2); g2.connect(g);

  g.connect(master!);
  if (verbSend) g.connect(verbSend);
  o.start(t0); o.stop(t0 + dur + 0.05);
  o2.start(t0); o2.stop(t0 + dur * 0.6 + 0.05);
}

/** Soffio: rumore filtrato che sale o scende. Serve per i passaggi (slide, modalità). */
function soffio(c: AudioContext, opts: { at?: number; dur?: number; from: number; to: number; gain: number }) {
  const t0 = c.currentTime + (opts.at ?? 0);
  const dur = opts.dur ?? 0.22;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource(); src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = "bandpass"; f.Q.value = 1.1;
  f.frequency.setValueAtTime(opts.from, t0);
  f.frequency.exponentialRampToValueAtTime(opts.to, t0 + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(opts.gain, t0 + dur * 0.25);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f); f.connect(g); g.connect(master!);
  if (verbSend) g.connect(verbSend);
  src.start(t0); src.stop(t0 + dur + 0.02);
}

/** Scala di riferimento (LA maggiore): tutti i suoni pescano da qui, così
 *  due eventi ravvicinati non possono stonare. */
const N = { la3: 440, do4: 554.37, mi4: 659.25, la4: 880, do5: 1108.73, mi5: 1318.51, la5: 1760, re4: 587.33, fa4: 698.46 };

/** Suoni troppo ravvicinati diventano un crepitio: quelli d'interfaccia si
 *  diradano da soli. Gli eventi importanti passano sempre. */
function troppoVicino(minMs: number): boolean {
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  if (now - lastAt < minMs) return true;
  lastAt = now;
  return false;
}

function suona(fn: (c: AudioContext) => void, minMs = 0) {
  if (isOff()) return;
  if (minMs && troppoVicino(minMs)) return;
  const c = audio();
  if (!c) return;
  if (master) master.gain.value = 0.9 * volume;
  try { fn(c); } catch { /* un suono mancato non è un problema */ }
}

// ── LO STESSO SUONO ANCHE DAL CLIENTE ───────────────────────────────────────
//  I suoni raccontano quello che stai facendo: una voce che si sceglie, una
//  schermata che cambia, un preventivo che nasce. Restavano però sul TUO
//  dispositivo: il cliente vedeva le cose muoversi in silenzio, e per lui la
//  consulenza era muta.
//  Ora ogni suono viene anche ANNUNCIATO sul canale della consulenza, e il
//  dispositivo del cliente lo RIGENERA da sé, alla sua massima resa: non è un
//  file audio che passa dalla rete — è la stessa formula, suonata lì. Nessun
//  ritardo, nessun consumo, nessuna differenza di qualità.
type NomeSuono = "knock" | "joined" | "left" | "slide" | "mode" | "field" | "select"
  | "deselect" | "selectDeal" | "page" | "success" | "error";
let ponte: ((nome: NomeSuono, arg?: string) => void) | null = null;
/** Meetly registra qui il modo di far arrivare i suoni al cliente. */
export function setSfxBridge(fn: ((nome: NomeSuono, arg?: string) => void) | null) { ponte = fn; }
/** true mentre stiamo eseguendo un suono ARRIVATO da fuori: non si rimbalza. */
let inArrivo = false;
function annuncia(nome: NomeSuono, arg?: string) {
  //  ⚠️ La spia sta PRIMA dell'uscita anticipata: i suoni vanno contati anche
  //   quando non c'è nessun ponte verso il cliente — che è il caso normale sul
  //   dispositivo del cliente, dove il conto serve.
  visto(nome);
  if (inArrivo || !ponte) return;
  try { ponte(nome, arg); } catch { /* il suono locale è già partito */ }
}
/** Esegue sul QUESTO dispositivo un suono annunciato dall'altro lato.
 *  Volume pieno: al cliente arriva come suono della consulenza, non come un
 *  dettaglio dell'interfaccia di qualcun altro. */
export function suonaRemoto(nome: string, arg?: string) {
  const f = (sfx as unknown as Record<string, (a?: string) => void>)[nome];
  if (typeof f !== "function") return;
  inArrivo = true;
  const primaVol = volume;
  try { volume = 1; f(arg); } finally { volume = primaVol; inArrivo = false; }
}
/** Guadagno applicato a tutti i suoni: 1 = come sono stati pensati. */
let volume = 1;

/** ── CHI STA SUONANDO, PER IL DIARIO DEL CLIENTE ───────────────────────────
 *  Segnalazione del committente: «l'utente quando sta dentro sente bip bip
 *  bip». Sul telefono di chi è in consulenza non c'è una console da guardare:
 *  questa spia permette a Meetly di CONTARE i suoni che partono davvero e di
 *  lasciarne detto il conto (vedi shop/conta-suoni).
 *  ⚠️ Non cambia niente di come si suona: osserva e basta, e un guasto dentro
 *   la spia non deve togliere il suono a chi lo aspetta. */
let spia: ((nome: string) => void) | null = null;
export function setSpiaSuoni(fn: ((nome: string) => void) | null) { spia = fn; }
function visto(nome: string) {
  if (!spia) return;
  try { spia(nome); } catch { /* una spia rotta non spegne i suoni */ }
}

export const sfx = {
  /** QUALCUNO BUSSA — è in sala d'attesa. Volume pieno: deve arrivare anche se
   *  il consulente sta guardando altrove. Due campane in quinta, ripetute:
   *  il doppio colpo è ciò che lo rende riconoscibile come "qualcuno è qui". */
  knock() {
    /*  ── ⚠️ QUESTA NON SI ANNUNCIA AL CLIENTE ──────────────────────────
        Segnalazione del committente: «gli ospiti sentono un campanello ogni 5
        secondi». Questa campana vuol dire «c'è qualcuno alla porta»: è un
        avviso per CHI APRE, non per chi bussa. Rigenerarla sul dispositivo del
        cliente vuol dire fargli sentire l'annuncio di sé stesso — e, finché
        aspetta, una volta ogni quattro secondi, perché è ogni quattro secondi
        che ribussa.
        Gli altri suoni restano annunciati: raccontano al cliente quello che sta
        succedendo sullo schermo che sta guardando. Questo no — succede dietro
        una porta che lui non vede. */
    visto("knock");
    suona((c) => {
      const V = 0.5;
      nota(c, { freq: N.mi4, dur: 0.75, gain: 1 }, V);
      nota(c, { freq: N.la4, at: 0.02, dur: 0.85, gain: 0.8 }, V);
      nota(c, { freq: N.mi5, at: 0.05, dur: 0.7, gain: 0.45 }, V);
      nota(c, { freq: N.mi4, at: 0.42, dur: 0.75, gain: 0.9 }, V);
      nota(c, { freq: N.la4, at: 0.44, dur: 0.95, gain: 0.75 }, V);
      nota(c, { freq: N.do5, at: 0.47, dur: 0.9, gain: 0.4 }, V);
    });
  },

  /** ENTRATO IN CHIAMATA — lo sentono entrambi. Accordo maggiore che sale, con
   *  coda lunga: chiude il momento invece di annunciarlo, ed è il motivo per
   *  cui si capisce che il collegamento c'è senza bisogno di guardare. */
  joined() {
    annuncia("joined");
    suona((c) => {
      const V = 0.42;
      soffio(c, { from: 900, to: 2600, dur: 0.26, gain: 0.05 });
      nota(c, { freq: N.la3, at: 0.02, dur: 1.0, gain: 0.75 }, V);
      nota(c, { freq: N.do4, at: 0.10, dur: 1.0, gain: 0.7 }, V);
      nota(c, { freq: N.mi4, at: 0.18, dur: 1.2, gain: 0.7 }, V);
      nota(c, { freq: N.la4, at: 0.26, dur: 1.4, gain: 0.5 }, V);
    });
  },

  /** USCITO — lo stesso accordo al contrario, più piano: chiude, non allarma. */
  left() {
    annuncia("left");
    suona((c) => {
      const V = 0.3;
      nota(c, { freq: N.la4, dur: 0.5, gain: 0.6 }, V);
      nota(c, { freq: N.mi4, at: 0.09, dur: 0.6, gain: 0.6 }, V);
      nota(c, { freq: N.la3, at: 0.18, dur: 0.9, gain: 0.5 }, V);
    });
  },

  /** CAMBIO SLIDE — il fruscio di una pagina che gira, con una punta di nota
   *  sopra perché resti musicale e non un rumore. */
  slide() {
    annuncia("slide");
    suona((c) => {
      soffio(c, { from: 2400, to: 700, dur: 0.19, gain: 0.075 });
      nota(c, { freq: N.mi5, at: 0.015, dur: 0.2, gain: 0.5 }, 0.16);
    }, 90);
  },

  /** CAMBIO MODALITÀ / SCHERMATA — soffio che sale: si passa a qualcos'altro. */
  mode() {
    annuncia("mode");
    suona((c) => {
      soffio(c, { from: 600, to: 2300, dur: 0.24, gain: 0.075 });
      nota(c, { freq: N.la4, at: 0.06, dur: 0.34, gain: 0.55 }, 0.18);
      nota(c, { freq: N.do5, at: 0.12, dur: 0.4, gain: 0.4 }, 0.18);
    }, 120);
  },

  /** CAMPO DEL MODULO — il tocco più leggero di tutti: una sola nota corta,
   *  quasi un polpastrello sul vetro. Ripetuto decine di volte non deve
   *  stancare, quindi è appena sopra la soglia. */
  field() {
    annuncia("field");
    suona((c) => { nota(c, { freq: N.la5, dur: 0.11, gain: 0.6 }, 0.075); }, 70);
  },

  /** OPZIONE SCELTA — due note che salgono: si è aggiunto qualcosa. */
  select() {
    annuncia("select");
    suona((c) => {
      nota(c, { freq: N.do5, dur: 0.16, gain: 0.7 }, 0.13);
      nota(c, { freq: N.mi5, at: 0.055, dur: 0.24, gain: 0.6 }, 0.13);
    }, 60);
  },

  /** OPZIONE TOLTA — le stesse due note al contrario. */
  deselect() {
    annuncia("deselect");
    suona((c) => {
      nota(c, { freq: N.mi5, dur: 0.14, gain: 0.6 }, 0.11);
      nota(c, { freq: N.do5, at: 0.055, dur: 0.22, gain: 0.55 }, 0.11);
    }, 60);
  },

  /** OPZIONE IN PROMOZIONE O GRATUITA — la stessa presa dell'altra, ma con una
   *  terza nota sopra che le dà luce. Deve distinguersi al primo ascolto senza
   *  diventare una fanfara: chi configura ne sceglie dieci di fila. */
  selectDeal() {
    annuncia("selectDeal");
    suona((c) => {
      const V = 0.13;
      nota(c, { freq: N.do5, dur: 0.16, gain: 0.7 }, V);
      nota(c, { freq: N.mi5, at: 0.05, dur: 0.22, gain: 0.6 }, V);
      nota(c, { freq: N.la5, at: 0.10, dur: 0.42, gain: 0.42 }, V);
    }, 60);
  },

  /** CAMBIO DI SCHERMATA — una firma diversa per ogni pagina, così il suono
   *  dice DOVE sei arrivato e non solo che qualcosa è cambiato. Sempre due note
   *  brevissime: cambiando pagina spesso, tutto ciò che dura si trasforma in
   *  rumore. */
  page(dove: "preventivo" | "slide" | "media" | "web" | "percorso" | "creato") {
    annuncia("page", dove);
    const F: Record<string, [number, number]> = {
      preventivo: [N.la4, N.do5],     // sale poco: si apre un foglio
      slide:      [N.do5, N.mi5],     // più alto: contenuto che scorre
      media:      [N.mi4, N.la4],     // pieno: immagini e video
      web:        [N.la4, N.mi5],     // salto ampio: si esce dal nostro sito
      percorso:   [N.do4, N.mi4],     // basso e calmo: si legge una scheda
      creato:     [N.la4, N.mi5],
    };
    const [a, b] = F[dove] ?? F.preventivo;
    suona((c) => {
      soffio(c, { from: 700, to: 2000, dur: 0.16, gain: 0.05 });
      nota(c, { freq: a, at: 0.02, dur: 0.22, gain: 0.6 }, 0.17);
      nota(c, { freq: b, at: 0.08, dur: 0.34, gain: 0.5 }, 0.17);
    }, 200);
  },

  /** CONFERMA IMPORTANTE (preventivo creato, modifica applicata). */
  success() {
    annuncia("success");
    suona((c) => {
      const V = 0.3;
      nota(c, { freq: N.do5, dur: 0.3, gain: 0.7 }, V);
      nota(c, { freq: N.mi5, at: 0.07, dur: 0.34, gain: 0.65 }, V);
      nota(c, { freq: N.la5, at: 0.14, dur: 0.7, gain: 0.5 }, V);
    });
  },

  /** QUALCOSA NON È ANDATO: due note vicine, basse. Nessun allarme. */
  error() {
    annuncia("error");
    suona((c) => {
      nota(c, { freq: N.re4, dur: 0.22, gain: 0.6, type: "triangle" }, 0.22);
      nota(c, { freq: N.fa4, at: 0.11, dur: 0.34, gain: 0.5, type: "triangle" }, 0.22);
    });
  },
};
