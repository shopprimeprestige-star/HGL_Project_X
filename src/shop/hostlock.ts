// ── Elezione del trasmettitore ─────────────────────────────────────────────
//  Stessa causa del vecchio "lampeggio 1 secondo / 1 secondo" sul preventivo:
//  la stessa pagina può essere montata DUE volte nello stesso browser
//   - la finestra esterna del presentatore,
//   - l'iframe dell'anteprima dispositivo (DeviceFrame, ?embed=1),
//   - una seconda scheda lasciata aperta.
//  Se due contesti trasmettono sullo stesso canale, l'ospite riceve a raffica
//  due stati DIVERSI (uno col media scelto, uno ancora vuoto) e alterna fra la
//  schermata d'attesa e il contenuto. Con questo lock vince UN solo contesto;
//  l'iframe dell'anteprima ha priorità sulla finestra esterna perché è lì che
//  il presentatore clicca davvero.
const SRC = Math.random().toString(36).slice(2, 9); // id univoco per contesto/caricamento
const STALE_MS = 2500;

function myPrio(): number {
  if (typeof window === "undefined") return 0;
  const inFrame = window.self !== window.top || new URLSearchParams(window.location.search).get("embed") === "1";
  return inFrame ? 1 : 0;
}

/** true se questo contesto è (o diventa) IL trasmettitore per `key`. */
export function claimHostLock(key: string): boolean {
  if (typeof window === "undefined") return false;
  const now = Date.now();
  const prio = myPrio();
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const j = JSON.parse(raw) as { src?: string; ts?: number; prio?: number };
      const fresh = now - (Number(j?.ts) || 0) < STALE_MS;
      if (j?.src && j.src !== SRC && fresh && (Number(j.prio) || 0) >= prio) return false;
    }
    localStorage.setItem(key, JSON.stringify({ src: SRC, ts: now, prio }));
    return true;
  } catch { return true; }
}

/** Il presentatore ha appena CLICCATO qui: questo contesto diventa senz'altro il
 *  trasmettitore. Senza questo, un contesto gemello (la finestra esterna mentre
 *  si lavora nell'anteprima, o una scheda lasciata aperta) poteva tenersi il
 *  lock e l'azione appena fatta non raggiungeva il cliente: da fuori sembrava
 *  "a me la mostra, a lui no". */
export function forceHostLock(key: string): void {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(key, JSON.stringify({ src: SRC, ts: Date.now(), prio: 9 })); } catch { /* */ }
}
