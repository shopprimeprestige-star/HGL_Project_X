/** ── LA FILIGRANA SULLE ANTEPRIME ──────────────────────────────────────────
 *
 *  L'immagine che esce da qui finisce su WhatsApp, su Instagram, nel telefono
 *  di un amico — staccata dal sito e da noi. Senza un marchio sopra è una
 *  fotografia di uno sconosciuto con dei capelli: non dice chi l'ha fatta, non
 *  riporta nessuno qui, e nel dubbio sembra una foto vera (che è il problema
 *  peggiore dei due).
 *
 *  ── ⚠️ COME LA FANNO I MARCHI SERI, E PERCHÉ ─────────────────────────────
 *  Non un timbro in un angolo — si ritaglia in due secondi — ma una trama
 *  RIPETUTA in diagonale su tutta l'immagine, molto tenue, più il marchio
 *  grande al centro. Chi la guarda quasi non la vede; chi prova a toglierla
 *  deve rifare la faccia.
 *
 *  ── ⚠️ LA FOTOGRAFIA RESTA A PIENO CAMPO ─────────────────────────────────
 *  Niente cornice attorno: una cornice ruba spazio proprio alla cosa che
 *  vende — la faccia — e in una chat è la faccia grande che ferma il pollice.
 *  Il marchio vive SOPRA l'immagine, su una velatura scura in fondo che lo
 *  tiene leggibile su qualunque fotografia.
 *
 *  ── ⚠️ CHI PAGA NON CE L'HA ──────────────────────────────────────────────
 *  È il primo dei vantaggi del pacchetto, ed è quello che si capisce senza
 *  spiegazioni: la foto pulita, da mandare a chi si vuole. Il controllo non sta
 *  qui — questa funzione disegna e basta — ma nella pagina, che la chiama solo
 *  quando serve.
 */

const FONT = "ui-sans-serif, -apple-system, system-ui, sans-serif";

export interface Filigrana {
  /** il testo del marchio, quando il logo non si può disegnare */
  testo: string;
  /** il logo, se è già caricato e disegnabile */
  logo?: HTMLImageElement | null;
  /** L'indirizzo da scrivere in fondo: è la parte che riporta qui chi riceve
   *  l'immagine, e cambia se cambia il sito. */
  dominio?: string;
  /** Il nome del taglio — «Sfumato con ciuffo». Va nell'etichetta in alto:
   *  chi riceve la fotografia in chat, senza, non sa che taglio sta guardando,
   *  e quella domanda la fa uno su dieci. */
  taglio?: string;
  /** Il nome del colore — «Castano medio». */
  colore?: string;
  /** ⚠️ Il campione del colore, in esadecimale: è il pallino dell'etichetta,
   *  l'unico pezzo che cambia a ogni anteprima. Si legge prima delle parole —
   *  ed è la ragione per cui l'etichetta non sembra una didascalia qualunque. */
  campione?: string;
}

/** ── OGNI SEGNO CON IL SUO ALONE ────────────────────────────────────────────
 *  Una filigrana bianca su una camicia bianca non esiste, e una scura sui
 *  capelli neri nemmeno. L'alone morbido sotto — non un contorno duro, che
 *  invecchia di dieci anni qualunque marchio — la fa sopravvivere su qualunque
 *  fondo, che è l'unica cosa che le si chiede.
 */
function marchio(
  ctx: CanvasRenderingContext2D,
  f: Filigrana,
  cx: number,
  cy: number,
  largo: number,
  opacita: number,
): void {
  ctx.save();
  ctx.shadowColor = `rgba(0,0,0,${Math.min(0.5, opacita * 2.2)})`;
  ctx.shadowBlur = Math.max(2, largo / 22);
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.globalAlpha = opacita;
  if (f.logo && f.logo.naturalWidth > 0) {
    const alto = largo * (f.logo.naturalHeight / Math.max(1, f.logo.naturalWidth));
    ctx.drawImage(f.logo, cx - largo / 2, cy - alto / 2, largo, alto);
  } else {
    const corpo = largo / 9;
    ctx.font = `300 ${corpo}px ${FONT}`;
    ctx.letterSpacing = `${corpo * 0.22}px`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#fff";
    ctx.fillText(f.testo.toUpperCase(), cx, cy);
    ctx.letterSpacing = "0px";
    ctx.textAlign = "left";
  }
  ctx.restore();
}

/** La trama in diagonale più il marchio grande al centro. */
export function stendiFiligrana(
  ctx: CanvasRenderingContext2D,
  larghezza: number,
  altezza: number,
  f: Filigrana,
): void {
  const passo = Math.max(larghezza, altezza) / 4.6;
  const largo = passo * 0.5;

  ctx.save();
  ctx.translate(larghezza / 2, altezza / 2);
  ctx.rotate(-Math.PI / 7);
  ctx.translate(-larghezza / 2, -altezza / 2);
  const diagonale = Math.hypot(larghezza, altezza);
  let riga = 0;
  for (let y = -diagonale / 2; y < diagonale; y += passo) {
    const sfalso = (riga % 2) * (passo / 2);
    for (let x = -diagonale / 2; x < diagonale; x += passo) {
      marchio(ctx, f, x + sfalso, y, largo, 0.05);
    }
    riga += 1;
  }
  ctx.restore();

  marchio(ctx, f, larghezza / 2, altezza / 2, larghezza * 0.44, 0.11);
}

function tondo(x: number, y: number, w: number, h: number, r: number): Path2D {
  const p = new Path2D();
  p.moveTo(x + r, y);
  p.arcTo(x + w, y, x + w, y + h, r);
  p.arcTo(x + w, y + h, x, y + h, r);
  p.arcTo(x, y + h, x, y, r);
  p.arcTo(x, y, x + w, y, r);
  p.closePath();
  return p;
}

/** Le forbici: tratto sottile: a questa misura un'icona spessa sembra un
 *  timbro. `cy` è il centro dell'icona, non il suo angolo. */
function forbici(ctx: CanvasRenderingContext2D, x: number, cy: number, lato: number): void {
  ctx.save();
  ctx.translate(x, cy - lato / 2);
  ctx.scale(lato / 24, lato / 24);
  ctx.strokeStyle = "#9fd8ff";
  ctx.lineWidth = 1.8;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke(new Path2D("M6 4l10.5 12.5M18 4L7.5 16.5"));
  ctx.beginPath();
  ctx.arc(6.2, 18.4, 2.6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(17.8, 18.4, 2.6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** ── L'ETICHETTA IN ALTO ───────────────────────────────────────────────────
 *  Una capsula di vetro scuro con un filo di luce sul bordo alto: forbici,
 *  il nome del taglio, un divisore, il pallino del colore vero e il suo nome.
 *
 *  ⚠️ IL PALLINO NON È UN ORNAMENTO. È l'unico pezzo dell'etichetta che cambia
 *   a ogni anteprima, e si legge prima delle parole: senza, questa resta una
 *   didascalia come tante — in maiuscolo spaziato, senza faccia.
 *
 *  ⚠️ E la capsula si MISURA prima di disegnarla. I nomi dei tagli non sono
 *   tutti lunghi uguali, e uno lungo, senza misura, esce dall'immagine: il
 *   corpo si stringe finché entra, e se non basta si accorcia il nome del
 *   taglio, che è il pezzo più lungo. La riga non si rompe mai.
 */
function etichetta(
  ctx: CanvasRenderingContext2D,
  larghezza: number,
  corto: number,
  margine: number,
  f: Filigrana,
): void {
  const taglio = String(f.taglio || "").trim();
  const colore = String(f.colore || "").trim();
  if (!taglio && !colore) return;

  const massimo = larghezza - margine * 2;
  let corpo = corto * 0.03;
  let nome = taglio;
  const minimo = corto * 0.022;
  const misura = (): { larga: number; wT: number; wC: number } => {
    ctx.font = `600 ${corpo}px ${FONT}`;
    const wT = nome ? ctx.measureText(nome).width : 0;
    ctx.font = `500 ${corpo * 0.92}px ${FONT}`;
    const wC = colore ? ctx.measureText(colore).width : 0;
    const respiro = corpo * 0.85;
    const icona = corpo * 1.15;
    const stacco = corpo * 0.6;
    let larga = respiro * 2;
    if (nome) larga += icona + stacco * 0.85 + wT;
    if (colore) {
      if (nome) larga += stacco * 1.2 + Math.max(1, corto * 0.0012) + stacco * 1.2;
      larga += corpo * 0.62 + stacco * 0.7 + wC;
    }
    return { larga, wT, wC };
  };
  let m = misura();
  while (m.larga > massimo && corpo > minimo) {
    corpo = Math.max(minimo, corpo * 0.94);
    m = misura();
  }
  while (m.larga > massimo && nome.length > 4) {
    nome = `${nome.slice(0, -2).trimEnd()}…`;
    m = misura();
  }
  if (m.larga > massimo) return;

  const respiro = corpo * 0.85;
  const icona = corpo * 1.15;
  const stacco = corpo * 0.6;
  const pallino = corpo * 0.62;
  const alta = corpo * 2.5;
  const capsula = tondo(margine, margine, m.larga, alta, alta / 2);

  ctx.save();
  ctx.fillStyle = "rgba(8,13,24,0.62)";
  ctx.fill(capsula);
  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.lineWidth = Math.max(1, corto * 0.0014);
  ctx.stroke(capsula);
  //  il filo di luce sul bordo alto: è quello che fa «vetro» invece di «scatola»
  ctx.save();
  ctx.clip(capsula);
  const luce = ctx.createLinearGradient(0, margine, 0, margine + alta * 0.6);
  luce.addColorStop(0, "rgba(255,255,255,0.13)");
  luce.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = luce;
  ctx.fillRect(margine, margine, m.larga, alta * 0.6);
  ctx.restore();

  const cy = margine + alta / 2;
  let x = margine + respiro;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  if (nome) {
    forbici(ctx, x, cy, icona);
    x += icona + stacco * 0.85;
    ctx.font = `600 ${corpo}px ${FONT}`;
    ctx.fillStyle = "rgba(255,255,255,0.96)";
    ctx.fillText(nome, x, cy);
    x += m.wT + stacco * 1.2;
  }
  if (colore) {
    if (nome) {
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.fillRect(x, cy - alta * 0.26, Math.max(1, corto * 0.0012), alta * 0.52);
      x += stacco * 1.2;
    }
    if (f.campione) {
      ctx.beginPath();
      ctx.arc(x + pallino / 2, cy, pallino / 2, 0, Math.PI * 2);
      ctx.fillStyle = f.campione;
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = Math.max(1, corto * 0.001);
      ctx.stroke();
    }
    x += pallino + stacco * 0.7;
    ctx.font = `500 ${corpo * 0.92}px ${FONT}`;
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.fillText(colore, x, cy);
  }
  ctx.restore();
}

/** ── IL PIEDE ──────────────────────────────────────────────────────────────
 *  Marchio a sinistra, promessa a destra, indirizzo sotto. Una scala sola, con
 *  la promessa in cima: tre voci alla stessa altezza non fanno gerarchia,
 *  fanno rumore.
 *
 *  ⚠️ La promessa è in tondo, non in maiuscolo spaziato: il maiuscolo largo è
 *   esattamente ciò che fa sembrare vecchia una scritta su una fotografia.
 */
function piede(
  ctx: CanvasRenderingContext2D,
  larghezza: number,
  altezza: number,
  corto: number,
  margine: number,
  f: Filigrana,
): void {
  //  la velatura: senza, su una fotografia chiara non si legge niente
  const velo = ctx.createLinearGradient(0, altezza * 0.6, 0, altezza);
  velo.addColorStop(0, "rgba(4,7,14,0)");
  velo.addColorStop(1, "rgba(4,7,14,0.93)");
  ctx.fillStyle = velo;
  ctx.fillRect(0, altezza * 0.6, larghezza, altezza * 0.4);

  const base = altezza - margine * 1.2;
  ctx.save();
  if (f.logo && f.logo.naturalWidth > 0) {
    const alto = corto * 0.05;
    const largo = alto * (f.logo.naturalWidth / Math.max(1, f.logo.naturalHeight));
    ctx.globalAlpha = 0.95;
    ctx.drawImage(f.logo, margine, base - alto * 0.95, largo, alto);
    ctx.globalAlpha = 1;
  } else {
    ctx.font = `600 ${corto * 0.03}px ${FONT}`;
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(f.testo, margine, base - corto * 0.012);
  }

  const promessa = corto * 0.036;
  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";
  ctx.font = `600 ${promessa}px ${FONT}`;
  ctx.fillStyle = "rgba(255,255,255,0.97)";
  ctx.fillText("Il tuo risultato ti aspetta", larghezza - margine, base - promessa * 0.3);

  const minuto = corto * 0.019;
  ctx.font = `500 ${minuto}px ${FONT}`;
  ctx.letterSpacing = `${minuto * 0.16}px`;
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.fillText(
    String(f.dominio || "hairgeniuslabs.hair").toUpperCase(),
    larghezza - margine,
    base + minuto * 1.4,
  );
  ctx.letterSpacing = "0px";
  ctx.restore();
}

/** Rifà l'immagine con la filigrana sopra. Torna un data URL nuovo.
 *  ⚠️ Se qualcosa va storto torna l'immagine com'era: meglio un'anteprima
 *   senza marchio che nessuna anteprima. */
export async function conFiligrana(dataUrl: string, f: Filigrana): Promise<string> {
  try {
    const img = await new Promise<HTMLImageElement>((ok, no) => {
      const i = new Image();
      i.crossOrigin = "anonymous";
      i.onload = () => ok(i);
      i.onerror = () => no(new Error("immagine illeggibile"));
      i.src = dataUrl;
    });
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    const tela = document.createElement("canvas");
    tela.width = w;
    tela.height = h;
    const ctx = tela.getContext("2d");
    if (!ctx) return dataUrl;

    ctx.drawImage(img, 0, 0, w, h);
    const corto = Math.min(w, h);
    const margine = corto * 0.05;
    stendiFiligrana(ctx, w, h, f);
    piede(ctx, w, h, corto, margine, f);
    etichetta(ctx, w, corto, margine, f);
    return tela.toDataURL("image/jpeg", 0.92);
  } catch {
    return dataUrl;
  }
}

/** Il logo del marchio, caricato una volta sola e riusato.
 *  ⚠️ `crossOrigin` serve: senza, disegnarlo sporca la tela e `toDataURL`
 *   smette di funzionare — l'anteprima resterebbe senza marchio e senza un
 *   errore che lo spieghi. */
export function caricaLogo(url: string): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null);
  return new Promise((ok) => {
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => ok(i);
    i.onerror = () => ok(null);
    i.src = url;
  });
}
