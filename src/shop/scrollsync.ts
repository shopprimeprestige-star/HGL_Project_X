// ─────────────────────────────────────────────────────────────────────────────
// SINCRONIZZAZIONE SCROLL "PER ANCORE" — VERSIONE SEMPLICE E VERIFICABILE
// ─────────────────────────────────────────────────────────────────────────────
// Regola unica: il presentatore dice SOLO "in cima al mio schermo c'è il blocco
// <id>"; l'ospite porta QUEL blocco in cima al proprio schermo con l'allineamento
// del browser (`scrollIntoView({ block: "start" })`). Nessuna matematica di
// pixel trasferiti, nessun confronto di altezze, nessuna proporzione: erano
// esattamente quelle a produrre la deriva (la stessa sezione è alta 900px sul
// desktop e 2500px sul telefono → qualunque offset trasportato sbaglia di
// centinaia di px).
//
// Unico dato accessorio: `sub` (0..1) — quanto si è avanzati DENTRO l'ancora.
// Usato SOLO se quell'ancora è più alta del viewport dell'ospite (altrimenti il
// blocco ci sta tutto e "in cima" è già la risposta esatta).
//
// Restano due cose imprescindibili:
//  · BORDO VISIBILE: sul presentatore la barra della chiamata è `fixed` e riserva
//    spazio con `body { padding-top }`. Ciò che vede in cima è
//    `scrollTop + insetTop`, non `scrollTop`. Si misura da sé, sui due lati.
//  · GUARDIA 3px: due applicazioni ravvicinate sullo stesso punto non riscrivono
//    lo scroll (su iOS un `scrollTo` durante lo slancio del dito lo interrompe).
//
// ⚠️ ANCORE NON VALIDE (causa storica del disallineamento): un'ancora NASCOSTA
// (`lg:hidden` — il riepilogo mobile mentre il presentatore è su desktop) ha
// rect 0×0 in posizione 0 → risultava "esattamente sulla linea di lettura" e
// veniva scelta come ancora di testa; l'ospite, che quel blocco ce l'ha DAVVERO
// (in fondo alla pagina), saltava a fine pagina. Stesso problema per un elemento
// `sticky`/`fixed`: la sua posizione è incollata al bordo, quindi sembra sempre
// "in cima". Entrambi ora sono ESCLUSI dall'inventario delle ancore.

export type ScrollAnchor = {
  a: string;    // id dell'ancora in cima allo schermo del presentatore
  sub: number;  // 0..1 dentro l'ancora — usato solo se l'ancora > viewport ospite
  /** altezza della fascia DALLA PARTE DEL PRESENTATORE, in px.
   *  Serve a capire se i due layout sono comparabili: quando lo sono, la
   *  posizione si trasferisce in PIXEL (esatta) invece che in proporzione
   *  (che su fasce alte sbaglia di centinaia di px). */
  sp?: number;
};

/** scroller da usare: `null` = la finestra/pagina. */
export type ScrollRoot = HTMLElement | null;

const docTop = (): number =>
  window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;

export const scrollTopOf = (root: ScrollRoot): number => (root ? root.scrollTop : docTop());

export const scrollMaxOf = (root: ScrollRoot): number => {
  if (root) return Math.max(0, root.scrollHeight - root.clientHeight);
  const de = document.documentElement;
  return Math.max(0, de.scrollHeight - window.innerHeight);
};

/** altezza dell'area visibile dello scroller */
const viewportOf = (root: ScrollRoot): number =>
  root ? root.clientHeight : window.innerHeight;

/** in quale contesto JS gira questo codice (finestra esterna o iframe anteprima) */
export const scrollContext = (): "iframe" | "top" => {
  if (typeof window === "undefined") return "top";
  try {
    const embed = new URLSearchParams(window.location.search).get("embed") === "1";
    return window.self !== window.top || embed ? "iframe" : "top";
  } catch { return "iframe"; }
};

const vp = (root: ScrollRoot): string =>
  `${root ? root.clientWidth : (typeof window === "undefined" ? 0 : window.innerWidth)}x${
    typeof window === "undefined" ? 0 : viewportOf(root)}`;

/**
 * Un'ancora è USABILE solo se è davvero visibile e davvero legata al flusso:
 *  · display:none / 0×0  → il layout dell'altro lato non la mostra;
 *  · sticky / fixed      → è incollata al bordo, non indica una posizione.
 */
function usableAnchor(el: HTMLElement, root: ScrollRoot): boolean {
  // DIFESA: si gira su nodi che possono sparire fra una misura e l'altra
  // (ri-render, popup chiuso). Un'eccezione qui uscirebbe fino al render.
  if (!el || typeof el.getClientRects !== "function") return false;
  try {
  if (!el.getClientRects().length) return false;
  if (el.getBoundingClientRect().height <= 0) return false;
  // NB: si controlla da `el` fino a (escluso) lo scroller stesso — lo scroller
  // può benissimo essere `position: fixed` (la vista "Il tuo percorso" è
  // `fixed inset-0`) senza che le sue ancore interne siano incollate.
  const stop: Node | null = root ?? (typeof document === "undefined" ? null : document.body);
  let n: HTMLElement | null = el;
  let guard = 200;                       // niente cicli infiniti su alberi strani
  while (n && n !== stop && guard-- > 0) {
    const pos = getComputedStyle(n).position;
    if (pos === "sticky" || pos === "fixed") return false;
    n = n.parentElement;
  }
  return true;
  } catch { return false; }
}

/**
 * Ancore che APPARTENGONO a questo scroller: un'ancora dentro un altro
 * contenitore marcato `data-hg-scroll` (es. la vista "Il tuo percorso" aperta
 * sopra il preventivo) non deve inquinare lo scroll della pagina.
 */
function anchorsIn(root: ScrollRoot): HTMLElement[] {
  if (typeof document === "undefined") return [];
  const scope: ParentNode = root ?? document;
  const all = Array.from(scope.querySelectorAll("[data-hg-anchor]")) as HTMLElement[];
  return all.filter((el) => {
    const owner = el.closest("[data-hg-scroll]") as HTMLElement | null;
    if (root ? owner !== root : owner !== null) return false;
    return usableAnchor(el, root);
  });
}

export const anchorIds = (root: ScrollRoot): string[] =>
  anchorsIn(root).map((el) => el.getAttribute("data-hg-anchor") || "?");

// ── INVENTARIO: le due console, affiancate, devono rendere ovvio un disallineamento
const invSig = new Map<string, string>();
export function logAnchors(tag: string, root: ScrollRoot): void {
  const ids = anchorIds(root);
  const sig = ids.join("|");
  if (invSig.get(tag) === sig) return;      // solo quando l'insieme cambia davvero
  invSig.set(tag, sig);
  console.log(`[SCROLL] ancore disponibili (${tag}, ${scrollContext()}, viewport=${vp(root)}): [${ids.join(", ")}]`);
}

/** posizione dell'ancora nel sistema di coordinate dello scroller */
function topIn(el: HTMLElement, root: ScrollRoot): number {
  const r = el.getBoundingClientRect();
  if (!root) return r.top + docTop();
  return r.top - root.getBoundingClientRect().top + root.scrollTop;
}

/**
 * CHROME FISSO CHE OCCLUDE IL BORDO SUPERIORE (px).
 * Sul presentatore la barra della chiamata è `position: fixed` in alto e riserva
 * spazio con `document.body.style.paddingTop`: quel padding è ESATTAMENTE la
 * porzione di viewport coperta. L'ospite non ha barre → 0. Dentro l'iframe di
 * anteprima dispositivo (embed=1) non c'è alcuna barra → 0.
 */
export function insetTopOf(root: ScrollRoot): number {
  if (typeof document === "undefined" || !document.body) return 0;
  const v = parseFloat(getComputedStyle(document.body).paddingTop || "0");
  const bar = Number.isFinite(v) && v > 0 ? v : 0;
  if (!bar) return 0;
  if (!root) return bar;
  const top = root.getBoundingClientRect().top;
  return Math.max(0, Math.min(bar, bar - top));
}

/** bordo REALMENTE visibile in cima, nelle coordinate dello scroller */
export const topEdgeOf = (root: ScrollRoot): number => scrollTopOf(root) + insetTopOf(root);

/**
 * PRESENTATORE — quale ancora è in cima allo schermo (e, solo se quell'ancora è
 * più alta dello schermo, quanto si è avanzati al suo interno).
 * `offset`: tolleranza (px) per considerare "in cima" un blocco che sporge appena.
 */
/**
 * SEGMENTI: la pagina viene divisa dalle ancore in fasce CONTIGUE.
 * Il segmento di un'ancora va dal suo inizio all'inizio dell'ancora SUCCESSIVA
 * (l'ultimo arriva a fine documento). È la differenza chiave rispetto a prima,
 * quando si usava l'altezza dell'ELEMENTO: fra un'ancora e l'altra restavano
 * "buchi" non descritti da nessuno, e in quei buchi la posizione dell'ospite era
 * un'ipotesi. Con i segmenti contigui ogni pixel della pagina appartiene a
 * esattamente una fascia, dalla parte del presentatore come da quella
 * dell'ospite → la corrispondenza esiste sempre ed è continua.
 */
const segCache = new Map<object | string, { at: number; v: { id: string; el: HTMLElement; t: number; span: number }[] }>();

function segments(root: ScrollRoot): { id: string; el: HTMLElement; t: number; span: number }[] {
  // Le posizioni arrivano ~8 volte al secondo. Rimisurare la geometria di TUTTE
  // le ancore a ogni messaggio costringe il browser del telefono a rifare il
  // layout altrettante volte: su iPhone è la differenza fra una pagina che
  // scorre e una scheda che il sistema chiude per consumo. 120 ms di memoria
  // sono impercettibili per l'occhio e tolgono il grosso del lavoro.
  const key = root ?? "doc";
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  const hit = segCache.get(key);
  if (hit && now - hit.at < 120) return hit.v;
  const v = segmentsRaw(root);
  segCache.set(key, { at: now, v });
  return v;
}

function segmentsRaw(root: ScrollRoot): { id: string; el: HTMLElement; t: number; span: number }[] {
  const els = anchorsIn(root);
  if (!els.length) return [];
  const m = els
    // ── SOLO ANCORE DI PRIMO LIVELLO ──────────────────────────────────────
    //  MISURATO SUL SITO PUBBLICATO, causa dell'imprecisione che resisteva:
    //  le schede-opzione hanno una propria ancora, e su DESKTOP stanno
    //  AFFIANCATE, quindi iniziano alla STESSA altezza:
    //    cfg-base-patch-standard@340  ·  cfg-base-invisible-derm@340
    //  Sul telefono invece sono IMPILATE: @310 e @452.
    //  Risultato: sul presentatore la prima delle due aveva una fascia di
    //  larghezza zero e veniva scavalcata; il cliente saltava direttamente alla
    //  seconda scheda. Lo stesso accadeva con le due opzioni di fitting.
    //  Un blocco affiancato su un layout e impilato sull'altro NON può fare da
    //  riferimento: non esiste corrispondenza fra le due geometrie.
    //  Restano quindi solo le ancore di SEZIONE (hero, step-01, step-02, dati,
    //  riepilogo), che compaiono una volta sola e nello stesso ordine su
    //  entrambi i layout — verificato: 5 fasce identiche di qua e di là.
    //  ⚠️ La regola vale SOLO per la pagina intera. Dentro un PANNELLO le ancore
    //  sono poche e messe apposta: applicando anche lì il filtro, quelle annidate
    //  sparivano tutte e il pannello non aveva più alcun riferimento → lo scroll
    //  interno non si rispecchiava più (regressione).
    //  ── PERCHÉ ORA SI TENGONO TUTTE ──────────────────────────────────────
    //  Il filtro "solo ancore di primo livello" lasciava CINQUE fasce per una
    //  pagina lunghissima: dentro una fascia alta migliaia di pixel la
    //  posizione era una proporzione, e una proporzione su una fascia enorme
    //  sbaglia di centinaia di pixel. Era questa la causa del "il cliente è più
    //  avanti di me". Il caso che quel filtro doveva risolvere — due schede
    //  AFFIANCATE su desktop che iniziano alla stessa altezza — è già coperto
    //  dalla deduplica a 24px qui sotto, che tiene solo la prima delle due.
    .map((el) => ({ id: el.getAttribute("data-hg-anchor") || "", el, t: topIn(el, root) }))
    .filter((x) => !!x.id)
    .sort((a, b) => a.t - b.t)
    // rete di sicurezza: due ancore che iniziano praticamente insieme non
    // possono delimitare una fascia utile → si tiene la prima.
    .filter((x, i, arr) => i === 0 || x.t - arr[i - 1].t >= 24);
  const end = (root ? root.scrollHeight : (typeof document === "undefined" ? 0 : document.documentElement.scrollHeight)) || 0;
  // FASCIA INIZIALE: tutto ciò che sta PRIMA della prima ancora (intestazione,
  // logo, banner della diretta). Senza, "sono in cima" veniva tradotto con
  // "porta in cima la prima ancora" e il cliente apriva la pagina saltando
  // proprio la parte iniziale.
  if (m.length && m[0].t > 4) m.unshift({ id: "__inizio", el: m[0].el, t: 0 });
  return m.map((x, i) => ({ ...x, span: Math.max(1, (i + 1 < m.length ? m[i + 1].t : end) - x.t) }));
}

export function readAnchor(root: ScrollRoot, offset = 12): ScrollAnchor | null {
  try { return readAnchorInner(root, offset); } catch (e) { console.warn("[SCROLL] lettura posizione fallita:", e); return null; }
}

function readAnchorInner(root: ScrollRoot, offset = 12): ScrollAnchor | null {
  const segs = segments(root);
  if (!segs.length) return null;
  logAnchors("presentatore", root);
  // ── LA BARRA DEL PRESENTATORE NON È SCORRIMENTO ───────────────────────────
  //  Qui si usava `scrollTop + insetTop`, cioè "quale pixel si trova sotto la
  //  mia barra fissa". Ma quella barra è TUA: il cliente non ce l'ha. Con te in
  //  cima alla pagina il sistema comunicava comunque un avanzamento pari
  //  all'altezza della barra, e il cliente apriva la pagina già oltre l'inizio —
  //  senza vedere la parte iniziale. Ora conta solo QUANTO HAI SCORSO: tu in
  //  cima ⇒ lui in cima.
  const edge = scrollTopOf(root);
  let cur = segs[0];
  for (const s of segs) { if (s.t <= edge + offset) cur = s; else break; }
  const id = cur.id;
  if (!id) return null;
  // AVANZAMENTO CONTINUO dentro la fascia (0..1). Non più "0 oppure una frazione
  // enorme": qui la posizione è descritta con la stessa risoluzione ovunque, e
  // ai confini fra due fasce vale esattamente 0 (o 1) su entrambi i dispositivi.
  const sub = Math.max(0, Math.min(0.999, (edge - cur.t) / cur.span));
  return { a: id, sub: Math.round(sub * 10000) / 10000, sp: Math.round(cur.span) };
}

/**
 * OSPITE — porta la stessa ancora in cima al PROPRIO schermo.
 * Ritorna il pixel applicato, oppure `null` se l'ancora non esiste da questa
 * parte (→ il chiamante usa il fallback a frazione).
 */
// ── CACHE RIMOSSA ───────────────────────────────────────────────────────────
//  Memorizzava "questa posizione l'ho già applicata" e la ripeteva senza fare
//  nulla. Ma se il primo tentativo era caduto nel vuoto — pagina non ancora
//  alta abbastanza, tipico sul telefono subito dopo l'ingresso — la posizione
//  risultava per sempre "già applicata" e non veniva più eseguita.

// ── SCORRIMENTO CONTINUO ────────────────────────────────────────────────────
//  PERCHÉ SEMBRAVA "A SCATTI, PER SOGLIE": le posizioni arrivano ~10 volte al
//  secondo e venivano APPLICATE DI COLPO. Il cliente non scorreva: veniva
//  teletrasportato dieci volte al secondo, e ogni salto era tanto più lungo
//  quanto più la sua pagina è alta rispetto alla tua. Da fuori sembrava che
//  superata una soglia si passasse di scatto alla successiva.
//  Ora fra una posizione e l'altra il movimento viene ANIMATO fotogramma per
//  fotogramma: il cliente scorre in modo naturale, esattamente quanto scorri tu.
interface Glide { target: number; raf: number }
const glides = new Map<object | string, Glide>();

/** Salto immediato: cambio pagina/schermata, dove un'animazione sarebbe assurda. */
const JUMP_PX = 900;

function glideTo(scope: object | string, root: ScrollRoot, target: number) {
  const g = glides.get(scope);
  if (g) { g.target = target; return; }          // animazione già in corso: cambia solo il bersaglio
  const from = scrollTopOf(root);
  if (Math.abs(target - from) > JUMP_PX) {       // troppo lontano: si arriva subito
    if (root) root.scrollTop = target; else window.scrollTo({ top: target, behavior: "auto" });
    return;
  }
  const state: Glide = { target, raf: 0 };
  const step = () => {
    const cur = scrollTopOf(root);
    const d = state.target - cur;
    if (Math.abs(d) <= 1) {                      // arrivato: si ferma (nessun ciclo perenne)
      glides.delete(scope);
      return;
    }
    // inseguimento esponenziale: copre la distanza in ~100ms, cioè prima che
    // arrivi la posizione successiva → nessun ritardo, nessuna scia.
    const next = cur + d * 0.35;
    if (root) root.scrollTop = next; else window.scrollTo({ top: next, behavior: "auto" });
    state.raf = requestAnimationFrame(step);
  };
  glides.set(scope, state);
  state.raf = requestAnimationFrame(step);
}

export function applyAnchor(root: ScrollRoot, anc: string | ScrollAnchor, sub = 0): number | null {
  try { return applyAnchorInner(root, anc, sub); }
  catch (e) {
    // Meglio una posizione non applicata che una consulenza interrotta.
    console.warn("[SCROLL] posizione non applicabile:", e);
    return null;
  }
}

function applyAnchorInner(root: ScrollRoot, anc: string | ScrollAnchor, sub = 0): number | null {
  if (typeof document === "undefined" || !anc) return null;
  const src: ScrollAnchor = typeof anc === "string" ? { a: anc, sub } : anc;
  if (!src.a) return null;
  // ── NIENTE LAVORO INUTILE SUL DISPOSITIVO DEL CLIENTE ─────────────────────
  //  Le posizioni arrivano ~10 volte al secondo anche quando il presentatore è
  //  fermo. Rimisurare ogni volta la geometria di tutte le ancore forza il
  //  browser del telefono a ricalcolare il layout 10 volte al secondo: lavoro
  //  che toglie fotogrammi al video della chiamata. Se la posizione richiesta è
  //  identica all'ultima applicata, non si tocca niente.
  logAnchors("ospite", root);
  const segs = segments(root);
  const seg = segs.find((x) => x.id === src.a) || null;
  const el = seg?.el || null;
  const s = Math.max(0, Math.min(1, Number(src.sub) || 0));
  if (!el) {
    console.log(`[SCROLL] ricevuto TOP=${src.a} sub=${s} → trovato? no (viewport=${vp(root)})`);
    console.log(`[SCROLL] ANCORA MANCANTE ${src.a} — ancore presenti: [${anchorIds(root).join(", ")}]`);
    return null;
  }
  const max = scrollMaxOf(root);
  if (max <= 4) {
    console.log(`[SCROLL] ricevuto TOP=${src.a} → trovato? sì, ma qui non c'è nulla da scorrere (viewport=${vp(root)})`);
    return null;
  }
  const inset = insetTopOf(root);
  // ── LA POSIZIONE SI CALCOLA, NON SI "AVVICINA" ────────────────────────────
  //  Il presentatore dice: "sono al <sub> della fascia <a>". L'ospite prende la
  //  PROPRIA fascia <a> — che sul suo schermo è alta diversamente — e si porta
  //  esattamente allo stesso punto proporzionale al suo interno.
  //  Le fasce sono contigue su entrambi i lati, quindi la corrispondenza è
  //  continua: scorrendo, l'ospite scorre insieme senza salti, e all'inizio di
  //  ogni fascia i due schermi coincidono al pixel.
  //  Niente più `scrollIntoView` (portava con sé lo scroll-margin del browser e
  //  poteva agire su un contenitore annidato) e niente più correzione applicata
  //  solo alle ancore più alte dello schermo: quella era la fonte del salto.
  // ── PIXEL SE SI PUÒ, PROPORZIONE SE NON SI PUÒ ────────────────────────────
  //  Se la fascia è alta più o meno uguale sui due schermi (stesso layout, o
  //  layout diversi ma blocco che si comporta allo stesso modo), l'avanzamento
  //  si trasferisce in PIXEL: il cliente vede esattamente la stessa riga.
  //  Se invece le due fasce sono molto diverse — desktop contro telefono, dove
  //  lo stesso blocco può essere alto il triplo — i pixel non hanno alcun
  //  significato comune e si torna alla proporzione.
  const spanLoro = Number(src.sp) || 0;
  const rapporto = spanLoro > 0 ? seg!.span / spanLoro : 0;
  const dentro = rapporto >= 0.75 && rapporto <= 1.34
    ? Math.min(s * spanLoro, seg!.span - 1)          // stessa riga, al pixel
    : s * seg!.span;                                 // layout incomparabili
  const target = Math.round(Math.max(0, Math.min(max, seg!.t + dentro - inset)));
  const cur = scrollTopOf(root);
  // GUARDIA 3px: due applicazioni ravvicinate sullo stesso punto non riscrivono
  // lo scroll (su iOS un `scrollTo` durante lo slancio del dito lo interrompe).
  if (Math.abs(cur - target) > 3) glideTo(root ?? "doc", root, target);
  const done = target;   // dove il cliente sta arrivando (l'animazione lo raggiunge)
  console.log(`[SCROLL] ricevuto ${src.a} sub=${s} → ${done}px (fascia ${Math.round(seg!.t)}→${Math.round(seg!.t + seg!.span)}, viewport=${vp(root)})`);
  return done;
}

/** applica la vecchia frazione 0..1 — SOLO quando l'ancora non esiste da questa parte */
/** Il cliente ha scorso di suo: qualunque animazione in corso si ferma qui,
 *  altrimenti la pagina gli combatte sotto il dito. */
export function stopGlide(root: ScrollRoot = null): void {
  const key = root ?? "doc";
  const g = glides.get(key);
  if (!g) return;
  cancelAnimationFrame(g.raf);
  glides.delete(key);
}

export function applyRatio(root: ScrollRoot, s: number): boolean {
  const max = scrollMaxOf(root);
  if (max <= 4) return false;
  const top = Math.max(0, Math.min(1, s)) * max;
  if (root) root.scrollTop = top;
  else window.scrollTo({ top, behavior: "auto" });
  console.log(`[SCROLL] fallback frazione ${s.toFixed(3)} → scrollTo=${Math.round(top)}`);
  return true;
}

/** PRESENTATORE — una riga per invio, da leggere accanto a quella dell'ospite */
export const logOut = (tag: string, a: ScrollAnchor | null, root: ScrollRoot = null): void => {
  console.log(`[SCROLL] ${tag} contesto: ${scrollContext()} | TOP=${a ? a.a : "—"} sub=${a ? a.sub : "—"} (viewport=${vp(root)})`);
};
