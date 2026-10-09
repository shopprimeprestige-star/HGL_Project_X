/** LA SCHEDA CHE SI VEDE NELLA CHAT — una sola, per tutti i link
 *  ═══════════════════════════════════════════════════════════════════════════
 *
 *  Quando si manda un link, quello che decide se lo aprono non è la pagina: è
 *  il riquadro che compare nella chat, prima che qualcuno tocchi niente. Qui
 *  c'è il disegno, uguale per il webinar e per l'anteprima capelli: stesso
 *  fondo, stesso marchio, stesse pastiglie. Cambiano solo le parole.
 *
 *  ── ⚠️ PERCHÉ IL DISEGNO STA NEL BROWSER E NON SUL SERVITORE ─────────────
 *  I programmi di messaggistica NON leggono le immagini SVG: una scheda
 *  generata come SVG, per bella che sia, su WhatsApp non si vede. E sul
 *  servitore — Cloudflare Workers — non c'è né una tela su cui disegnare né un
 *  carattere tipografico. Il browser ha tutti e due: disegna, esporta in JPEG,
 *  e deposita (vedi api.anteprima).
 *
 *  ── ⚠️ 1200×675, E NON PIÙ ALTA ──────────────────────────────────────────
 *  I programmi di messaggistica RITAGLIANO l'anteprima alla loro forma, vicina
 *  al 16:9. Una tela più alta non dà spazio in più: fa sparire una fascia
 *  sopra e una sotto — cioè il marchio e la riga d'invito. Lo spazio si trova
 *  togliendo, non allargando.
 *
 *  ── ⚠️ IL MARCHIO È IL LOGO VERO, NON IL NOME SCRITTO ────────────────────
 *  Il nome composto col carattere di sistema si riconosce come «testo», non
 *  come marchio: in una chat piena di anteprime è la differenza fra una scheda
 *  di un'azienda e un riquadro qualunque. La scritta resta solo come ultima
 *  spiaggia, quando il logo non è stato caricato — e in quel caso il problema
 *  è un altro.
 */
import { intestazioniCRM } from "@/crm/AuthContext";

export const L = 1200;
export const A = 675;
const SX = 72;
const DX = L - 72;

export const COL = {
  fondo: "#050f24",
  alto: "#0c2149",
  marca: "#0f90fe",
  marcaChiara: "#8ecbff",
  viola: "#8b5cf6",
  diretta: "#f43f5e",
  bianco: "#ffffff",
} as const;

/** ── IL MARCHIO, CARICATO QUI E CON UN TEMPO MASSIMO ───────────────────────
 *  ⚠️ Prima si usava `precaricaLogo()` del biglietto, che tiene in memoria la
 *   PROMESSA e la riusa. Sembra un risparmio ed è una trappola: se quella
 *   promessa resta appesa una volta — un `decode()` che non finisce mai su un
 *   PNG arrivato dal ponte — resta appesa PER SEMPRE, e chiunque la aspetti si
 *   ferma con lei. È esattamente quello che è successo: il disegno della
 *   scheda non falliva, si fermava, e da fuori sembrava solo che l'anteprima
 *   non ci fosse.
 *  ⚠️ Qui si tiene in memoria l'IMMAGINE, non l'attesa: se un giro va male, il
 *   giro dopo riprova. E ogni passo ha il suo limite di tempo.
 */
type Marchio = ImageBitmap | HTMLImageElement;
let logoInMemoria: Marchio | null | undefined;

const conLimite = <X,>(p: Promise<X>, ms: number, dove: string): Promise<X> =>
  Promise.race([p, new Promise<X>((_, no) => setTimeout(() => no(new Error(`timeout: ${dove}`)), ms))]);

async function logoDelloStudio(): Promise<Marchio | null> {
  if (logoInMemoria !== undefined) return logoInMemoria;
  try {
    const risposta = await conLimite(fetch("/api/presenter/brand"), 4000, "marchio");
    if (!risposta.ok) throw new Error("marchio non disponibile");
    const dati = (await risposta.json()) as { logoUrl?: unknown };
    const indirizzo = typeof dati.logoUrl === "string" ? dati.logoUrl.trim() : "";
    if (!indirizzo) { logoInMemoria = null; return null; }

    //  ⚠️ Passa dal ponte: l'immagine arriva come file di QUESTO sito, quindi
    //   disegnarla sulla tela non la «sporca» e l'esportazione in JPEG resta
    //   possibile. Presa dal suo indirizzo originale, il browser rifiuterebbe
    //   di esportare la tela e non ci sarebbe nessuna scheda da depositare.
    const file = await conLimite(fetch(`/api/proxy?u=${encodeURIComponent(indirizzo)}`), 6000, "ponte");
    if (!file.ok || !(file.headers.get("content-type") || "").toLowerCase().startsWith("image/")) {
      throw new Error("il ponte non ha restituito un'immagine");
    }
    const blob = await file.blob();
    /** ── ⚠️ NIENTE `decode()`: SI FERMA NELLE SCHEDE IN SECONDO PIANO ────
     *  Era la ragione vera per cui la scheda usciva col nome scritto invece
     *  che col marchio. `HTMLImageElement.decode()` è legato al disegno della
     *  pagina, e il browser il disegno delle schede non attive lo rimanda —
     *  quindi l'attesa non finiva mai. E il gestionale, quando si deposita
     *  un'anteprima, è quasi sempre una scheda in secondo piano.
     *  `createImageBitmap` lavora sul file e basta: non ha niente a che fare
     *  con quello che si vede a schermo, e infatti risponde lo stesso. */
    if (typeof createImageBitmap === "function") {
      const bmp = await conLimite(createImageBitmap(blob), 6000, "lettura del marchio");
      logoInMemoria = bmp.width > 0 ? bmp : null;
      return logoInMemoria;
    }
    //  Ripiego per i browser senza `createImageBitmap`: `onload` scatta anche
    //  in secondo piano, `decode()` no.
    const url = URL.createObjectURL(blob);
    const img = new Image();
    const pronta = new Promise<void>((si, no) => {
      img.onload = () => si();
      img.onerror = () => no(new Error("marchio illeggibile"));
    });
    img.src = url;
    try { await conLimite(pronta, 6000, "lettura del marchio"); }
    finally { setTimeout(() => URL.revokeObjectURL(url), 0); }
    logoInMemoria = img.naturalWidth > 0 ? img : null;
    return logoInMemoria;
  } catch (e) {
    //  ⚠️ NON si ricorda il fallimento: `logoInMemoria` resta indefinito, così
    //   il prossimo disegno riprova invece di ereditare un guasto passeggero.
    console.warn("[ANTEPRIMA] marchio non caricato:", (e as Error)?.message || e);
    return null;
  }
}

const b = (a: number) => `rgba(255,255,255,${a})`;
const PILA = '"Inter", ui-sans-serif, system-ui, sans-serif';

function font(ctx: CanvasRenderingContext2D, peso: 400 | 500 | 600 | 700, corpo: number) {
  ctx.font = `${peso} ${corpo}px ${PILA}`;
  //  ⚠️ Se l'assegnazione non attecchisce resta `10px sans-serif`, cioè tutto
  //   il testo grande come una mosca — e in silenzio. Meglio fallire.
  if (ctx.font === "10px sans-serif") throw new Error("carattere non applicato");
}

const largh = (ctx: CanvasRenderingContext2D, t: string) => ctx.measureText(t).width;

function riquadro(x: number, y: number, w: number, h: number, r: number): Path2D {
  const p = new Path2D();
  p.moveTo(x + r, y);
  p.arcTo(x + w, y, x + w, y + h, r);
  p.arcTo(x + w, y + h, x, y + h, r);
  p.arcTo(x, y + h, x, y, r);
  p.arcTo(x, y, x + w, y, r);
  p.closePath();
  return p;
}

/** Va a capo misurando le parole. ⚠️ Il carattere va impostato PRIMA. */
function aCapo(ctx: CanvasRenderingContext2D, testo: string, larghezza: number, righe: number): string[] {
  const parole = String(testo || "").split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let riga = "";
  for (const pa of parole) {
    const prova = riga ? `${riga} ${pa}` : pa;
    if (largh(ctx, prova) <= larghezza || !riga) { riga = prova; continue; }
    out.push(riga);
    riga = pa;
    if (out.length === righe) break;
  }
  if (out.length < righe && riga) out.push(riga);
  if (out.join(" ").length < parole.join(" ").length && out.length) {
    let ultima = out[out.length - 1];
    while (ultima.length > 4 && largh(ctx, `${ultima}…`) > larghezza) ultima = ultima.slice(0, -1);
    out[out.length - 1] = `${ultima.trimEnd()}…`;
  }
  return out;
}

/** ── LE ICONE ──────────────────────────────────────────────────────────────
 *  Disegnate dai tracciati veri delle icone dell'interfaccia — lo stesso segno
 *  che si vede dentro il programma — e non da faccine: `Path2D` legge il
 *  tracciato SVG così com'è, e resta pulito a qualunque misura.
 *  ⚠️ La parola accanto dice la STESSA cosa dell'icona. Un'icona che promette
 *   una cosa e una parola che ne promette un'altra è peggio di nessuna icona:
 *   chi legge si ferma a capire invece di toccare.
 */
export const TRACCIATI: Record<string, string[]> = {
  //  onde radio: «c'è qualcuno che sta parlando adesso»
  diretta: ["M4.9 19.1a10 10 0 0 1 0-14.2", "M7.8 16.2a6 6 0 0 1 0-8.4", "M16.2 7.8a6 6 0 0 1 0 8.4", "M19.1 4.9a10 10 0 0 1 0 14.2"],
  //  schermo: «si apre dove sei già, nel browser»
  browser: ["M2 4h20v13H2z", "M2 8h20", "M8 21h8", "M12 17v4"],
  //  fumetto: «puoi scrivere e ti rispondiamo»
  chat: ["M21 14a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"],
  //  calendario: «l'orario è questo»
  quando: ["M3 5h18v16H3z", "M3 10h18", "M8 3v4", "M16 3v4"],
  //  macchina fotografica: «serve una tua foto»
  foto: ["M3 7h4l2-3h6l2 3h4v13H3z", "M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"],
  //  scintille: «lo fa da solo, in un attimo»
  magia: ["M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9z", "M18 15l.9 2.1L21 18l-2.1.9L18 21l-.9-2.1L15 18l2.1-.9z"],
  //  lucchetto: «la foto resta dov'è»
  riservato: ["M5 11h14v10H5z", "M8 11V7a4 4 0 0 1 8 0v4"],
  //  forbici: «è un taglio di capelli, non un filtro»
  taglio: ["M6 6a2.5 2.5 0 1 0 3.5 3.5L20 20", "M18 6a2.5 2.5 0 1 1-3.5 3.5L4 20"],
};

function icona(ctx: CanvasRenderingContext2D, nome: string, x: number, y: number, dim: number, colore: string) {
  const tracciati = TRACCIATI[nome] || TRACCIATI.diretta;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dim / 24, dim / 24);
  ctx.strokeStyle = colore;
  ctx.lineWidth = 1.9;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const d of tracciati) ctx.stroke(new Path2D(d));
  ctx.restore();
}

/** Una pastiglia con icona e parola. Torna la larghezza occupata. */
function pastiglia(ctx: CanvasRenderingContext2D, x: number, y: number, nome: string, testo: string, tinta: string): number {
  font(ctx, 600, 24);
  const w = 34 + 30 + 12 + largh(ctx, testo) + 26;
  const h = 62;
  ctx.fillStyle = "rgba(255,255,255,0.05)";
  ctx.fill(riquadro(x, y, w, h, 18));
  ctx.strokeStyle = "rgba(255,255,255,0.10)";
  ctx.lineWidth = 1.5;
  ctx.stroke(riquadro(x, y, w, h, 18));
  icona(ctx, nome, x + 24, y + 16, 30, tinta);
  ctx.fillStyle = b(0.88);
  font(ctx, 600, 24);
  ctx.fillText(testo, x + 24 + 30 + 14, y + 40);
  return w;
}

export interface Pastiglia { icona: string; testo: string; tinta?: string }

/** ── IL DISEGNINO «PRIMA → DOPO» ───────────────────────────────────────────
 *  ⚠️ Una scheda tutta di parole dice CHE COSA c'è dall'altra parte; questa
 *   dice come funziona, e lo dice in mezzo secondo: due fotografie e una
 *   freccia. Su un link che chiede a una persona di mandare la propria faccia,
 *   la differenza fra «ho capito» e «boh» è tutta qui.
 *  ⚠️ I due volti sono FIGURE, non fotografie: una faccia finta stampata
 *   sull'anteprima sarebbe una promessa su un risultato che non è il suo. Una
 *   sagoma si legge come «tu», e nessuno la scambia per un cliente vero.
 */
function volto(ctx: CanvasRenderingContext2D, cx: number, cy: number, capelli: boolean) {
  /** ── ⚠️ LA FIGURA «DOPO» È PIÙ CHIARA DELLA «PRIMA» ────────────────────
   *  Non è un vezzo: le due sagome hanno la stessa forma, quindi l'unica cosa
   *  che può dire «questo è il risultato» è la LUCE. Con lo stesso tono erano
   *  due figure identiche una accanto all'altra, e la seconda non guadagnava
   *  niente dall'essere seconda.
   *  ⚠️ E niente incarnato: una sagoma con la pelle finta somiglia a una
   *   persona che non esiste. Blu, come tutto il resto della scheda: si legge
   *   come «tu», e nessuno la scambia per un cliente vero. */
  const chiaro = capelli ? "#7d9ad8" : "#3d5687";
  const scuro = capelli ? "#4f6fb4" : "#2c3f66";

  //  spalle: larghe e basse, così la figura non «cade» in fondo al riquadro
  const spalle = ctx.createLinearGradient(0, cy + 60, 0, cy + 150);
  spalle.addColorStop(0, chiaro);
  spalle.addColorStop(1, scuro);
  ctx.fillStyle = spalle;
  ctx.beginPath();
  ctx.ellipse(cx, cy + 122, 70, 44, 0, Math.PI, Math.PI * 2);
  ctx.fill();

  //  testa: quasi tonda. ⚠️ Era un ovale alto 55 su 46, e sommato alle spalle
  //   faceva una figura tutta verticale — la sensazione di «stretto e lungo»
  //   che si vedeva a colpo d'occhio.
  const testa = ctx.createLinearGradient(cx - 48, cy - 52, cx + 48, cy + 52);
  testa.addColorStop(0, chiaro);
  testa.addColorStop(1, scuro);
  ctx.fillStyle = testa;
  ctx.beginPath();
  ctx.ellipse(cx, cy, 48, 52, 0, 0, Math.PI * 2);
  ctx.fill();

  if (!capelli) return;

  //  ── I CAPELLI ─────────────────────────────────────────────────────────
  //  ⚠️ L'ATTACCATURA SI DISEGNA AL CONTRARIO. Prima la chioma era una mezza
  //   ellisse: sotto le restava un TAGLIO ORIZZONTALE netto, all'altezza degli
  //   occhi, che si leggeva come un caschetto di plastica calato in testa.
  //   Qui la chioma è una massa piena, e poi si RIDISEGNA IL VISO sopra di
  //   essa un po' più in basso: quello che avanza ai lati e in cima sono i
  //   capelli, e il bordo fra i due è l'arco del viso — cioè un'attaccatura.
  const chioma = ctx.createLinearGradient(cx - 52, cy - 56, cx + 44, cy + 16);
  chioma.addColorStop(0, "#a27754");
  chioma.addColorStop(0.5, "#7a5334");
  chioma.addColorStop(1, "#4e3220");
  ctx.fillStyle = chioma;
  ctx.beginPath();
  ctx.ellipse(cx, cy - 14, 55, 50, 0, 0, Math.PI * 2);
  ctx.fill();

  const viso = ctx.createLinearGradient(cx - 42, cy - 40, cx + 42, cy + 52);
  viso.addColorStop(0, chiaro);
  viso.addColorStop(1, scuro);
  ctx.fillStyle = viso;
  ctx.beginPath();
  ctx.ellipse(cx, cy + 12, 40, 44, 0, 0, Math.PI * 2);
  ctx.fill();

  //  il riflesso in alto a sinistra: due tratti di luce e la massa smette di
  //  sembrare piatta.
  ctx.strokeStyle = "rgba(255,228,196,0.40)";
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.ellipse(cx - 4, cy - 18, 42, 36, 0, Math.PI * 1.08, Math.PI * 1.52);
  ctx.stroke();
}

function riquadroFoto(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  etichetta: string, capelli: boolean, acceso: boolean,
) {
  if (acceso) {
    //  ⚠️ L'alone sta SOTTO il riquadro e solo sul secondo: è l'unica cosa che
    //   dice quale dei due è il risultato, senza scriverlo.
    const alone = ctx.createRadialGradient(x + w / 2, y + h / 2, 10, x + w / 2, y + h / 2, w);
    alone.addColorStop(0, "rgba(15,144,254,0.38)");
    alone.addColorStop(1, "rgba(15,144,254,0)");
    ctx.fillStyle = alone;
    ctx.fillRect(x - 70, y - 70, w + 140, h + 140);
  }
  //  Il fondo del «dopo» è già il blu-viola del marchio: il risultato si vede
  //  che è nostro anche prima di guardarci dentro.
  if (acceso) {
    const dentro = ctx.createLinearGradient(x, y, x + w, y + h);
    dentro.addColorStop(0, "rgba(15,144,254,0.20)");
    dentro.addColorStop(1, "rgba(139,92,246,0.20)");
    ctx.fillStyle = dentro;
  } else {
    ctx.fillStyle = "rgba(255,255,255,0.035)";
  }
  ctx.fill(riquadro(x, y, w, h, 28));

  ctx.save();
  ctx.clip(riquadro(x, y, w, h, 28));
  volto(ctx, x + w / 2, y + 92, capelli);
  //  ⚠️ Una velatura scura in fondo: senza, l'etichetta cadeva sulle spalle
  //   della figura e le due cose si impastavano. Sfumata, non una fascia: una
  //   riga netta dentro una fotografia si legge come un errore di ritaglio.
  const velo = ctx.createLinearGradient(0, y + h - 76, 0, y + h);
  velo.addColorStop(0, "rgba(5,15,36,0)");
  velo.addColorStop(1, "rgba(5,15,36,0.94)");
  ctx.fillStyle = velo;
  ctx.fillRect(x, y + h - 76, w, 76);
  ctx.restore();

  ctx.strokeStyle = acceso ? "rgba(150,195,255,0.7)" : "rgba(255,255,255,0.13)";
  ctx.lineWidth = acceso ? 2.5 : 1.5;
  ctx.stroke(riquadro(x, y, w, h, 28));

  font(ctx, 700, 18);
  ctx.letterSpacing = "3px";
  ctx.fillStyle = acceso ? "#a9d4ff" : b(0.45);
  const wE = largh(ctx, etichetta);
  ctx.fillText(etichetta, x + (w - wE) / 2, y + h - 24);
  ctx.letterSpacing = "0px";
}

/** Le due fotografie e la freccia in mezzo.
 *  ⚠️ I riquadri sono meno alti di prima: 204×228 invece di 196×250. Non è
 *   pignoleria — due rettangoli alti e stretti accanto a un titolo grande
 *   tiravano tutta la scheda per il lungo, e l'occhio ci legge «stretto» prima
 *   ancora di capire cosa sono. */
function provaCapelli(ctx: CanvasRenderingContext2D, x: number, y: number) {
  const w = 204;
  const h = 228;
  const gap = 56;
  riquadroFoto(ctx, x, y, w, h, "PRIMA", false, false);
  riquadroFoto(ctx, x + w + gap, y, w, h, "DOPO", true, true);

  //  la freccia fra i due: stessa forma del tasto in fondo, così si legge
  //  come «questo diventa quello» e non come una decorazione.
  const fx = x + w + gap / 2;
  const fy = y + h / 2;
  ctx.strokeStyle = COL.marca;
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(fx - 16, fy);
  ctx.lineTo(fx + 12, fy);
  ctx.moveTo(fx + 1, fy - 11);
  ctx.lineTo(fx + 12, fy);
  ctx.lineTo(fx + 1, fy + 11);
  ctx.stroke();

  //  la scintilla sull'angolo del risultato: è il segno che di mezzo c'è il
  //  computer, e sta sull'immagine giusta.
  ctx.save();
  ctx.translate(x + w + gap + w - 36, y + 14);
  ctx.scale(30 / 24, 30 / 24);
  ctx.strokeStyle = "#d8ccff";
  ctx.lineWidth = 1.9;
  for (const d of TRACCIATI.magia) ctx.stroke(new Path2D(d));
  ctx.restore();
}

/** ── LA SALA IN DIRETTA ────────────────────────────────────────────────────
 *  ⚠️ La scheda del webinar era mezza vuota: a destra non c'era niente, e una
 *   metà bianca su un'anteprima si legge come «pagina non finita». Le parole
 *   dicevano già tutto, ma nessuno legge un'anteprima — la guarda.
 *  Qui c'è quello che sta dall'altra parte del link, disegnato: uno schermo
 *  acceso col tasto di riproduzione, la pastiglia rossa della diretta, le
 *  persone già collegate e due messaggi in chat. Quattro segni, e ognuno
 *  risponde a una domanda che una persona si fa prima di toccare il link:
 *  cos'è, è adesso, c'è qualcuno, posso parlare.
 *  ⚠️ Le persone sono sagome e non un numero: scrivere «128 collegati» su
 *   un'immagine che vive per giorni vorrebbe dire stampare una cifra falsa.
 */
function sala(ctx: CanvasRenderingContext2D, x: number, y: number) {
  const w = 464;
  const h = 286;

  //  l'alone dietro lo schermo: è quello che lo fa sembrare acceso
  const alone = ctx.createRadialGradient(x + w / 2, y + h / 2, 20, x + w / 2, y + h / 2, w * 0.75);
  alone.addColorStop(0, "rgba(15,144,254,0.30)");
  alone.addColorStop(1, "rgba(15,144,254,0)");
  ctx.fillStyle = alone;
  ctx.fillRect(x - 80, y - 80, w + 160, h + 160);

  const fondo = ctx.createLinearGradient(x, y, x + w, y + h);
  fondo.addColorStop(0, "rgba(15,144,254,0.18)");
  fondo.addColorStop(1, "rgba(139,92,246,0.18)");
  ctx.fillStyle = fondo;
  ctx.fill(riquadro(x, y, w, h, 30));
  ctx.strokeStyle = "rgba(150,195,255,0.45)";
  ctx.lineWidth = 2;
  ctx.stroke(riquadro(x, y, w, h, 30));

  // ── la pastiglia della diretta, in alto a sinistra dello schermo ───────
  {
    font(ctx, 700, 19);
    ctx.letterSpacing = "2px";
    const testo = "LIVE";
    const wp = largh(ctx, testo) + 62;
    ctx.fillStyle = "rgba(244,63,94,0.22)";
    ctx.fill(riquadro(x + 22, y + 22, wp, 40, 13));
    ctx.strokeStyle = "rgba(244,63,94,0.55)";
    ctx.lineWidth = 1.5;
    ctx.stroke(riquadro(x + 22, y + 22, wp, 40, 13));
    ctx.beginPath();
    ctx.arc(x + 44, y + 42, 7, 0, Math.PI * 2);
    ctx.fillStyle = COL.diretta;
    ctx.fill();
    ctx.fillStyle = "#ffc2ce";
    ctx.fillText(testo, x + 60, y + 49);
    ctx.letterSpacing = "0px";
  }

  // ── il tasto di riproduzione, al centro ───────────────────────────────
  const cx = x + w / 2;
  const cy = y + h / 2 + 4;
  //  due anelli sempre più deboli: è il modo fermo di disegnare un segnale
  //  che pulsa, e si capisce anche in un'immagine che non si muove.
  for (const [r, a] of [[74, 0.10], [58, 0.18]] as const) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(150,195,255,${a})`;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(cx, cy, 42, 0, Math.PI * 2);
  const tasto = ctx.createLinearGradient(cx - 42, cy - 42, cx + 42, cy + 42);
  tasto.addColorStop(0, COL.marca);
  tasto.addColorStop(1, "#6d5cf6");
  ctx.fillStyle = tasto;
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx - 12, cy - 18);
  ctx.lineTo(cx + 20, cy);
  ctx.lineTo(cx - 12, cy + 18);
  ctx.closePath();
  ctx.fillStyle = COL.bianco;
  ctx.fill();

  // ── chi c'è già: quattro sagome affiancate ────────────────────────────
  {
    const by = y + h - 44;
    for (let i = 0; i < 4; i += 1) {
      const bx = x + 34 + i * 28;
      ctx.beginPath();
      ctx.arc(bx, by, 19, 0, Math.PI * 2);
      ctx.fillStyle = "#0b1a34";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(bx, by, 16, 0, Math.PI * 2);
      const p = ctx.createLinearGradient(bx - 16, by - 16, bx + 16, by + 16);
      p.addColorStop(0, i % 2 ? "#2b4272" : "#33507f");
      p.addColorStop(1, "#1d2f52");
      ctx.fillStyle = p;
      ctx.fill();
      //  testa e spalle dentro il tondo: una pastiglia colorata non si legge
      //  come «una persona», una sagoma sì.
      ctx.save();
      ctx.beginPath();
      ctx.arc(bx, by, 16, 0, Math.PI * 2);
      ctx.clip();
      //  ⚠️ Sagoma CHIARA su tondo scuro, non il contrario: a sedici punti di
      //   raggio una figura scura dentro un tondo scuro diventa una macchia, e
      //   quattro macchie in fila non si leggono come «gente collegata».
      ctx.fillStyle = "rgba(226,238,255,0.92)";
      ctx.beginPath();
      ctx.arc(bx, by - 4, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(bx, by + 14, 10, 8, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // ── due messaggi in chat, in basso a destra ───────────────────────────
  {
    const bx = x + w - 150;
    const by = y + h - 74;
    ctx.fillStyle = "rgba(255,255,255,0.10)";
    ctx.fill(riquadro(bx, by, 118, 26, 13));
    ctx.fill(riquadro(bx + 26, by + 34, 92, 26, 13));
    ctx.save();
    ctx.translate(bx - 34, by - 2);
    ctx.scale(30 / 24, 30 / 24);
    ctx.strokeStyle = "#c4b5fd";
    ctx.lineWidth = 1.9;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const d of TRACCIATI.chat) ctx.stroke(new Path2D(d));
    ctx.restore();
  }
}

export interface Scheda {
  /** la parolina sopra il titolo, tutta maiuscola e spaziata */
  occhiello: string;
  titolo: string;
  /** una riga sola: toglie l'obiezione più comune */
  sotto: string;
  /** tre al massimo: sono le tre domande di chi riceve un link */
  pastiglie: Pastiglia[];
  /** la scritta del tasto in fondo */
  invito: string;
  /** la pastiglia in alto a destra: data, «in diretta», «3 prove incluse» */
  badge?: { testo: string; icona?: string; acceso?: boolean };
  /** l'illustrazione sulla destra. Stringe la colonna del testo.
   *  `capelli` = i due riquadri prima/dopo · `diretta` = la sala del webinar */
  visuale?: "capelli" | "diretta";
}

export async function disegnaScheda(tela: HTMLCanvasElement, s: Scheda): Promise<void> {
  tela.width = L;
  tela.height = A;
  const ctx = tela.getContext("2d");
  if (!ctx) throw new Error("tela non disponibile");
  //  ⚠️ Prima i caratteri: senza questa attesa la prima generazione esce col
  //   carattere di ripiego — ed è proprio quella che finisce nelle chat.
  if (document.fonts?.ready) await document.fonts.ready;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  // ── fondo: navy profondo, due aloni, griglia sottile ────────────────────
  const sfumatura = ctx.createLinearGradient(0, 0, L, A);
  sfumatura.addColorStop(0, COL.alto);
  sfumatura.addColorStop(1, COL.fondo);
  ctx.fillStyle = sfumatura;
  ctx.fillRect(0, 0, L, A);

  const alone1 = ctx.createRadialGradient(190, 120, 20, 190, 120, 560);
  alone1.addColorStop(0, "rgba(15,144,254,0.26)");
  alone1.addColorStop(1, "rgba(15,144,254,0)");
  ctx.fillStyle = alone1;
  ctx.fillRect(0, 0, L, A);
  const alone2 = ctx.createRadialGradient(L - 120, A, 20, L - 120, A, 620);
  alone2.addColorStop(0, "rgba(139,92,246,0.22)");
  alone2.addColorStop(1, "rgba(139,92,246,0)");
  ctx.fillStyle = alone2;
  ctx.fillRect(0, 0, L, A);

  ctx.strokeStyle = "rgba(255,255,255,0.045)";
  ctx.lineWidth = 1;
  for (let x = 100; x < L; x += 100) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, A); ctx.stroke(); }
  for (let y = 100; y < A; y += 100) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(L, y); ctx.stroke(); }

  //  Il filo in cima: è il segno che tiene insieme tutte le nostre schede.
  const filo = ctx.createLinearGradient(0, 0, L, 0);
  filo.addColorStop(0, "#34d399");
  filo.addColorStop(0.5, COL.marca);
  filo.addColorStop(1, COL.viola);
  ctx.fillStyle = filo;
  ctx.fillRect(0, 0, L, 5);

  // ── il marchio ──────────────────────────────────────────────────────────
  const logo = await logoDelloStudio();
  if (logo && logo.width > 0) {
    //  ⚠️ 52 di altezza e la larghezza di conseguenza: il logo è 2048×484, e
    //   forzarne la larghezza lo schiaccerebbe. Il tetto a 340 serve solo se
    //   un giorno venisse caricato un marchio molto più largo.
    const h = 52;
    const w = Math.min(340, (logo.width / logo.height) * h);
    ctx.drawImage(logo, SX, 50, w, h);
  } else {
    //  Ultima spiaggia: nessun logo caricato. Vedi la nota in cima.
    font(ctx, 700, 34);
    ctx.fillStyle = COL.bianco;
    ctx.fillText("Hair Genius ", SX, 90);
    ctx.fillStyle = COL.marca;
    ctx.fillText("Labs", SX + largh(ctx, "Hair Genius "), 90);
  }

  // ── la pastiglia in alto a destra ───────────────────────────────────────
  if (s.badge?.testo) {
    const acceso = !!s.badge.acceso;
    const testo = s.badge.testo;
    font(ctx, 700, 24);
    ctx.letterSpacing = acceso ? "3px" : "0px";
    const conIcona = !acceso && !!s.badge.icona;
    const w = largh(ctx, testo) + (conIcona ? 96 : 84);
    const x = DX - w;
    ctx.fillStyle = acceso ? "rgba(244,63,94,0.14)" : "rgba(255,255,255,0.06)";
    ctx.fill(riquadro(x, 52, w, 52, 16));
    ctx.strokeStyle = acceso ? "rgba(244,63,94,0.45)" : "rgba(255,255,255,0.14)";
    ctx.lineWidth = 1.5;
    ctx.stroke(riquadro(x, 52, w, 52, 16));
    if (conIcona) {
      icona(ctx, s.badge.icona as string, x + 24, 65, 26, COL.marcaChiara);
      ctx.fillStyle = b(0.92);
      ctx.fillText(testo, x + 62, 87);
    } else if (acceso) {
      //  Il pallino rosso: due millimetri che dicono «adesso», e li legge
      //  chiunque senza doverli imparare.
      ctx.beginPath();
      ctx.arc(x + 32, 78, 9, 0, Math.PI * 2);
      ctx.fillStyle = COL.diretta;
      ctx.fill();
      ctx.fillStyle = "#ffb3c1";
      ctx.fillText(testo, x + 52, 87);
    } else {
      ctx.fillStyle = b(0.92);
      ctx.fillText(testo, x + 42, 87);
    }
    ctx.letterSpacing = "0px";
  }

  /** ── ⚠️ LA COLONNA SI APPOGGIA AL FONDO, NON PARTE DALL'ALTO ───────────
   *  Con misure fisse dall'alto, un titolo di una riga sola lasciava un buco e
   *  la scheda sembrava a metà. Qui l'ultima riga del titolo sta SEMPRE alla
   *  stessa altezza e le righe crescono verso l'alto: con una riga o con due
   *  la parte bassa non si muove di un punto, e l'aria in più finisce sotto il
   *  marchio, dove sembra voluta. */
  /** ── ⚠️ DUE IMPAGINAZIONI, PERCHÉ LE DUE SCHEDE PESANO DIVERSO ────────
   *  La prima versione della scheda del webinar usava lo stesso impianto di
   *  quella dei capelli: testo a sinistra, disegno a destra, pastiglie e
   *  tasto in fondo a tutta larghezza. Con un titolo di una parola sola
   *  restava un buco in alto a sinistra e le pastiglie galleggiavano sotto
   *  l'illustrazione senza appartenere a niente: mezza scheda vuota e l'altra
   *  mezza affollata.
   *  Nella diretta le due colonne sono colonne vere e arrivano tutte e due in
   *  fondo: a sinistra il discorso (occhiello, titolo, riga, tasto), a destra
   *  la sala e sotto di lei le tre cose che la descrivono, incolonnate. */
  const aColonne = s.visuale === "diretta";
  const colonna = aColonne ? 528 : s.visuale ? 556 : DX - SX;
  const TITOLO_BASSO = aColonne ? 330 : 372;
  if (s.visuale === "capelli") provaCapelli(ctx, 660, 168);
  if (s.visuale === "diretta") sala(ctx, 660, 132);
  font(ctx, 700, 74);
  const righe = aCapo(ctx, String(s.titolo || "").trim(), colonna, 2);
  const primaRiga = TITOLO_BASSO - (righe.length - 1) * 86;

  font(ctx, 700, 26);
  ctx.letterSpacing = "8px";
  ctx.fillStyle = COL.marcaChiara;
  ctx.fillText(s.occhiello.toUpperCase(), SX, primaRiga - 92);
  ctx.letterSpacing = "0px";

  font(ctx, 700, 74);
  ctx.fillStyle = COL.bianco;
  righe.forEach((r, i) => ctx.fillText(r, SX, primaRiga + i * 86));

  //  ⚠️ Nella colonna stretta la riga sotto va a capo invece di uscire dal
  //   bordo: due righe più corte si leggono, una riga tagliata no.
  font(ctx, 400, s.visuale ? 26 : 30);
  ctx.fillStyle = b(0.62);
  aCapo(ctx, s.sotto, colonna, 2).forEach((r, i) => {
    ctx.fillText(r, SX, TITOLO_BASSO + (s.visuale ? 62 : 72) + i * 34);
  });

  // ── le tre cose che descrivono il link ──────────────────────────────────
  if (aColonne) {
    /*  Incolonnate sotto la sala, senza scatola attorno: sono didascalie
        dell'illustrazione, non tre bottoni. Una riga per ciascuna, icona a
        sinistra, e finiscono dove finisce la scheda — così la colonna destra
        non si interrompe a metà. */
    s.pastiglie.slice(0, 3).forEach((p, i) => {
      const y = 466 + i * 56;
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      ctx.fill(riquadro(660, y, 464, 46, 15));
      icona(ctx, p.icona, 678, y + 9, 28, p.tinta || COL.marcaChiara);
      font(ctx, 600, 24);
      ctx.fillStyle = b(0.85);
      ctx.fillText(p.testo, 718, y + 31);
    });
  } else {
    let x = SX;
    for (const p of s.pastiglie.slice(0, 3)) {
      x += pastiglia(ctx, x, 478, p.icona, p.testo, p.tinta || COL.marcaChiara) + 14;
    }
  }

  /** ── ⚠️ L'INVITO È UN TASTO, E STA SU UNA RIGA SUA ─────────────────────
   *  Accanto alle pastiglie ci finiva addosso: due cose diverse attaccate
   *  sembrano una cosa sola rotta. E la forma del tasto non è vanità — in
   *  un'anteprima nessuno può cliccare niente, quindi è la sola cosa che dice
   *  «di là si entra», che è tutto ciò che c'è da capire.
   */
  {
    const yTasto = aColonne ? 500 : 566;
    const hTasto = 70;
    font(ctx, 700, 30);
    const wTesto = largh(ctx, s.invito);
    //  ⚠️ La freccia vuole aria: attaccata alla parola sembrava parte di essa.
    const wTasto = wTesto + 140;
    const grad = ctx.createLinearGradient(SX, 0, SX + wTasto, 0);
    grad.addColorStop(0, COL.marca);
    grad.addColorStop(1, "#6d5cf6");
    ctx.fillStyle = grad;
    ctx.fill(riquadro(SX, yTasto, wTasto, hTasto, 22));
    ctx.fillStyle = COL.bianco;
    ctx.fillText(s.invito, SX + 40, yTasto + 45);
    //  la freccia: due segmenti, nessun carattere speciale da cui dipendere
    const fx = SX + 40 + wTesto + 46;
    const fy = yTasto + hTasto / 2;
    ctx.strokeStyle = COL.bianco;
    ctx.lineWidth = 3.4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(fx - 20, fy);
    ctx.lineTo(fx + 2, fy);
    ctx.moveTo(fx - 8, fy - 10);
    ctx.lineTo(fx + 2, fy);
    ctx.lineTo(fx - 8, fy + 10);
    ctx.stroke();
  }
}

/** Disegna, esporta in JPEG e deposita. ⚠️ Non lancia mai: se qualcosa va
 *  storto resta l'immagine di prima, e niente si blocca per un'anteprima. */
export async function depositaScheda(tipo: string, codice: string, s: Scheda): Promise<boolean> {
  /** ── ⚠️ NIENTE ATTESE SENZA FINE ───────────────────────────────────────
   *  Ogni passo ha un tempo massimo. Il primo tentativo di questa funzione
   *  non falliva: si FERMAVA — nessuna richiesta partiva, nessun errore
   *  compariva, e da fuori sembrava soltanto che l'immagine non ci fosse.
   *  Un deposito che non riesce è un fastidio; uno che resta appeso è un
   *  difetto che non si riesce nemmeno a cercare. */
  const entro = conLimite;
  try {
    const tela = document.createElement("canvas");
    await entro(disegnaScheda(tela, s), 12000, "disegno");
    const blob = await entro(
      new Promise<Blob | null>((ris) => tela.toBlob((x) => ris(x), "image/jpeg", 0.86)),
      8000,
      "esportazione",
    );
    if (!blob) throw new Error("la tela non ha prodotto nessun file");
    const modulo = new FormData();
    modulo.append("tipo", tipo);
    modulo.append("codice", codice);
    modulo.append("file", blob, `${tipo}-${codice}.jpg`);
    /** ── ⚠️ SENZA LE INTESTAZIONI DEL CRM IL DEPOSITO VIENE RIFIUTATO ────
     *  `/api/anteprima` scrive in uno spazio pubblico servito dal dominio del
     *  centro, quindi chiede chi sei — ed è giusto così. Senza queste due
     *  righe la richiesta tornava 401 e il fallimento era MUTO: la scheda non
     *  veniva depositata mai, nella chat compariva l'immagine generica, e da
     *  fuori sembrava che fosse sbagliata la data. Non era la data: non
     *  c'era proprio l'immagine. */
    //  ⚠️ Le intestazioni con un tempo massimo: `getSession()` può restare
    //   appesa (contesa sul lucchetto del browser), e senza questo limite il
    //   deposito non partiva mai. Meglio partire senza e prendersi un 401
    //   scritto in chiaro, che aspettare per sempre.
    const intestazioni = await entro(intestazioniCRM(), 6000, "sessione").catch(() => ({}));
    const r = await entro(
      fetch("/api/anteprima", { method: "POST", headers: intestazioni, body: modulo }),
      15000,
      "invio",
    );
    const j = (await r.json().catch(() => null)) as { ok?: boolean; reason?: string } | null;
    if (!j?.ok) throw new Error(`rifiutata (${r.status}): ${j?.reason || "nessuna ragione"}`);
    return true;
  } catch (e) {
    //  ⚠️ Si scrive nella console e non a schermo: non è un problema di chi
    //   sta lavorando — il link funziona lo stesso, cambia solo il riquadro
    //   nella chat. Ma qualcuno che lo cerca deve poterlo trovare.
    console.warn(`[ANTEPRIMA] ${tipo}/${codice} non depositata:`, (e as Error)?.message || e);
    return false;
  }
}
