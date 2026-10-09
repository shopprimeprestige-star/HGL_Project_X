/** ── I SUONI DELLE NOTIFICHE DEL CRM ───────────────────────────────────────
 *
 *  PERCHÉ SINTETIZZATI E NON UN FILE MP3
 *  Un file va scaricato, e la prima notifica della giornata arriverebbe muta
 *  proprio mentre la rete è lenta. Qui il suono nasce nel momento in cui serve:
 *  nessun byte da caricare, nessuna cache da invalidare al deploy, nessun
 *  ritardo fra l'evento e il segnale acustico.
 *
 *  PERCHÉ DUE LIVELLI E NON UNO SOLO
 *  Se tutto suona uguale, il cervello smette di distinguere e nel giro di due
 *  giorni si ignora tutto. Quindi:
 *   · DISCRETO — due note consonanti, brevi, in sottofondo. È il "prendi nota":
 *     installazione di domani, lead nuovo, saldo da incassare.
 *   · URGENTE — una figura di tre note ripetuta, più corpo e più volume. È il
 *     "alza la testa adesso": l'appuntamento sta iniziando, il cliente non si è
 *     presentato.
 *  Sono accordati sulla stessa scala, così due suoni ravvicinati non stonano.
 *
 *  PERCHÉ SERVE UNO SBLOCCO
 *  Nessun browser fa suonare nulla prima che l'utente abbia toccato la pagina:
 *  un AudioContext creato al caricamento nasce "suspended" e resta muto per
 *  sempre se nessuno lo risveglia. Per questo `installaSbloccoAudio()` mette in
 *  ascolto il PRIMO gesto (clic, tasto, tocco) e risveglia il contesto in quel
 *  momento — una volta sola, poi si stacca da solo.
 *  ───────────────────────────────────────────────────────────────────────── */

export type LivelloSuono = "discreto" | "urgente";

/** Cosa può rispondere il browser quando gli si chiede se può suonare. */
export type StatoAudio = "assente" | "bloccato" | "pronto";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

/** Ultimo istante in cui è stato emesso un suono: due notifiche a distanza di
 *  un battito diventano un rumore solo, sgradevole e illeggibile. */
let ultimoSuono = 0;
const PAUSA_MINIMA_MS = 900;

type CostruttoreAudio = typeof AudioContext;

function costruttore(): CostruttoreAudio | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    AudioContext?: CostruttoreAudio;
    webkitAudioContext?: CostruttoreAudio;
  };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

/** Il contesto audio, creato al primo uso e poi riusato.
 *  Si riusa quello condiviso di Meetly quando c'è: un secondo thread
 *  audio in tempo reale mentre è in corso una consulenza è spreco puro. */
function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    // Un contesto chiuso non si riapre: meglio ripartire da zero che restare
    // muti per tutto il resto della sessione.
    if (ctx && (ctx.state as string) === "closed") {
      ctx = null;
      master = null;
    }
    if (!ctx) {
      const w = window as unknown as { __hgAudioCtx?: AudioContext };
      if (w.__hgAudioCtx && (w.__hgAudioCtx.state as string) !== "closed") {
        ctx = w.__hgAudioCtx;
      } else {
        const Ctx = costruttore();
        if (!Ctx) return null;
        ctx = new Ctx();
        w.__hgAudioCtx = ctx;
      }
      master = ctx.createGain();
      master.gain.value = 1;
      master.connect(ctx.destination);
    }
    if (!master) {
      master = ctx.createGain();
      master.gain.value = 1;
      master.connect(ctx.destination);
    }
    return ctx;
  } catch {
    return null;
  }
}

/** Chi disegna lo stato dell'audio a schermo ascolta questo: il risveglio del
 *  contesto avviene dentro un gesto qualunque (un clic su un pulsante che non
 *  c'entra nulla con le notifiche) e React non ha modo di accorgersene. */
export const EVENTO_AUDIO = "hg-crm-audio";

function annuncia(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(EVENTO_AUDIO));
}

/** Da chiamare dentro un gesto dell'utente. Crea il contesto se manca e lo
 *  risveglia se il browser lo aveva sospeso.
 *  Restituisce la promessa del risveglio: chi deve suonare SUBITO dopo lo
 *  sblocco deve aspettarla, perché `resume()` non è istantaneo e un suono
 *  emesso su un contesto ancora sospeso non esce mai. */
export function sbloccaAudio(): Promise<void> {
  const c = audio();
  if (!c) return Promise.resolve();
  if (c.state !== "suspended") {
    annuncia();
    return Promise.resolve();
  }
  return c
    .resume()
    .then(() => annuncia())
    .catch(() => {
      /* il browser ha rifiutato: si riproverà al gesto successivo */
    });
}

/** Il contesto esiste ed è sveglio? Serve alla pagina Notifiche per dire la
 *  verità all'utente invece di promettere un suono che non arriverà. */
export function statoAudio(): StatoAudio {
  if (!costruttore()) return "assente";
  // Anche il contesto condiviso di Meetly conta: se è già sveglio lui, il
  // suono uscirà comunque e dire "bloccato" sarebbe una bugia.
  const w =
    typeof window !== "undefined" ? (window as unknown as { __hgAudioCtx?: AudioContext }) : null;
  const c = ctx ?? w?.__hgAudioCtx ?? null;
  if (!c) return "bloccato";
  return c.state === "running" ? "pronto" : "bloccato";
}

let sbloccoInstallato = false;

/** Mette in ascolto il primo gesto dell'utente e sblocca l'audio lì.
 *  Idempotente: chiamarla da più componenti non moltiplica gli ascoltatori. */
export function installaSbloccoAudio(): () => void {
  if (typeof window === "undefined" || sbloccoInstallato) return () => {};
  sbloccoInstallato = true;
  const eventi: Array<keyof WindowEventMap> = ["pointerdown", "keydown", "touchstart"];
  const alGesto = () => {
    // Ci si stacca solo a sblocco RIUSCITO. Il primo gesto può non bastare
    // (pagina appena caricata, contesto ancora in creazione): staccandosi
    // comunque, l'audio restava muto per tutta la sessione e non c'era modo di
    // riprovare se non ricaricando.
    void sbloccaAudio().then(() => {
      if (statoAudio() === "pronto") stacca();
    });
  };
  const stacca = () => {
    eventi.forEach((e) => window.removeEventListener(e, alGesto, true));
  };
  eventi.forEach((e) => window.addEventListener(e, alGesto, true));

  // Il browser sospende il contesto quando la scheda resta a lungo in secondo
  // piano: al ritorno va risvegliato, altrimenti la prima notifica è muta.
  // Vale anche per il contesto condiviso con Meetly, che può essere stato
  // creato da lì e non da qui.
  const alRitorno = () => {
    if (document.visibilityState !== "visible") return;
    const w = window as unknown as { __hgAudioCtx?: AudioContext };
    const c = ctx ?? w.__hgAudioCtx ?? null;
    // Mai chiuderlo, mai ricrearlo qui: un contesto chiuso non si riapre.
    if (c && c.state === "suspended") void c.resume().then(() => annuncia());
  };
  document.addEventListener("visibilitychange", alRitorno);

  return () => {
    stacca();
    document.removeEventListener("visibilitychange", alRitorno);
    sbloccoInstallato = false;
  };
}

/** Una nota: sinusoide con l'ottava sopra molto più piano.
 *  L'attacco di 12 ms evita il "clic" iniziale, la coda esponenziale evita il
 *  suono di plastica dei bip troncati di netto. */
function nota(
  c: AudioContext,
  uscita: AudioNode,
  freq: number,
  ritardo: number,
  durata: number,
  volume: number,
) {
  const t0 = c.currentTime + ritardo;
  const picco = Math.max(0.0002, volume);

  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(picco, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + durata);
  g.connect(uscita);

  const o = c.createOscillator();
  o.type = "sine";
  o.frequency.setValueAtTime(freq, t0);
  o.connect(g);
  o.start(t0);
  o.stop(t0 + durata + 0.02);

  // Armonica di ottava leggermente stonata (2.01×): è ciò che dà il timbro di
  // campana invece di quello di cicalino.
  const g2 = c.createGain();
  g2.gain.setValueAtTime(0.0001, t0);
  g2.gain.exponentialRampToValueAtTime(picco * 0.2, t0 + 0.012);
  g2.gain.exponentialRampToValueAtTime(0.0001, t0 + durata * 0.7);
  g2.connect(uscita);

  const o2 = c.createOscillator();
  o2.type = "sine";
  o2.frequency.setValueAtTime(freq * 2.01, t0);
  o2.connect(g2);
  o2.start(t0);
  o2.stop(t0 + durata + 0.02);
}

/** Le due figure musicali. Frequenze su una scala di La maggiore: le note dei
 *  due livelli appartengono allo stesso accordo, quindi non stonano fra loro. */
const FIGURE: Record<LivelloSuono, { voci: Array<[number, number, number]>; volume: number }> = {
  // La5 → Mi6: quinta ascendente, due note e via. Si sente, non si ascolta.
  discreto: {
    voci: [
      [880.0, 0, 0.26],
      [1318.5, 0.1, 0.34],
    ],
    volume: 0.075,
  },
  // Mi6 → La6 → Mi6, ripetuto una volta: il ripetersi è ciò che fa girare la
  // testa, più del volume. Resta sotto 1,2 s per non diventare un allarme.
  urgente: {
    voci: [
      [1318.5, 0, 0.2],
      [1760.0, 0.12, 0.2],
      [1318.5, 0.24, 0.3],
      [1318.5, 0.52, 0.2],
      [1760.0, 0.64, 0.2],
      [1318.5, 0.76, 0.42],
    ],
    volume: 0.14,
  },
};

/** Suona davvero, dando per scontato che il contesto sia sveglio. */
function emetti(c: AudioContext, livello: LivelloSuono, volume: number): boolean {
  if (!master || c.state !== "running") return false;
  const figura = FIGURE[livello];
  const vol = Math.max(0, Math.min(1, volume)) * figura.volume;
  if (vol <= 0) return false;
  try {
    figura.voci.forEach(([freq, at, dur]) => nota(c, master!, freq, at, dur, vol));
    return true;
  } catch {
    return false;
  }
}

/**
 * Emette il suono di notifica.
 * @param livello  quale delle due figure suonare
 * @param volume   0..1, moltiplicatore scelto dall'utente nelle preferenze
 * @param forza    ignora la pausa minima fra due suoni (serve al pulsante "prova")
 * @returns true se il suono è partito nell'istante stesso della chiamata
 */
export function suona(livello: LivelloSuono, volume = 1, forza = false): boolean {
  if (typeof window === "undefined") return false;
  const adesso = Date.now();
  if (!forza && adesso - ultimoSuono < PAUSA_MINIMA_MS) return false;

  const c = audio();
  if (!c || !master) return false;

  // La pausa minima si consuma solo se il suono esce davvero: segnarla su un
  // tentativo fallito significherebbe zittire anche quello buono che arriva
  // subito dopo.
  if (c.state === "running") {
    const uscito = emetti(c, livello, volume);
    if (uscito) ultimoSuono = adesso;
    return uscito;
  }

  // Contesto sospeso (scheda tornata in primo piano dopo ore): il risveglio è
  // ASINCRONO. Prima si suonava lo stesso e il suono finiva nel vuoto — è il
  // motivo per cui la prima notifica dopo una pausa lunga era muta. Adesso si
  // aspetta il risveglio e si suona subito dopo.
  void c
    .resume()
    .then(() => {
      annuncia();
      if (emetti(c, livello, volume)) ultimoSuono = Date.now();
    })
    .catch(() => {
      /* senza un gesto dell'utente il browser non concede l'audio: pazienza */
    });
  return false;
}

/** Il pulsante "prova il suono": sblocca (siamo dentro un clic, quindi si può),
 *  ASPETTA che il contesto sia sveglio e suona comunque, anche se un altro
 *  suono è appena passato. Il valore di ritorno è quello che il pulsante mostra
 *  all'utente, quindi deve dire la verità: da qui l'attesa. */
export async function provaSuono(livello: LivelloSuono, volume = 1): Promise<boolean> {
  await sbloccaAudio();
  const c = audio();
  if (!c) return false;
  ultimoSuono = Date.now();
  return emetti(c, livello, volume);
}
