/** L'ANTEPRIMA DEL PREVENTIVO — la mini-scheda che si vede nella chat
 *  ═══════════════════════════════════════════════════════════════════════════
 *
 *  Quando il consulente manda al cliente il link del suo preventivo, chi lo
 *  riceve vede prima di tutto un riquadro. Fino a ieri quel riquadro era una
 *  figura generica del sito: uguale per tutti, quindi muta. Qui si disegna la
 *  scheda di QUEL preventivo — il nome della persona, il totale, che cosa
 *  contiene — e diventa l'immagine dell'anteprima.
 *
 *  ── PERCHÉ SI DISEGNA QUI E NON SUL SERVITORE ─────────────────────────────
 *  Il servitore gira su Cloudflare Workers: niente tela, niente caratteri
 *  tipografici. Il browser invece ha tutti e due, e in questo preciso istante —
 *  subito dopo «Conferma» — ha anche tutti i dati in mano. Disegnare qui costa
 *  un decimo di secondo e non aggiunge nessuna libreria al progetto.
 *
 *  ── REGOLE DI DISEGNO (le stesse del biglietto, e per le stesse ragioni) ──
 *  · misure fisse 1200×675, che è la forma che i programmi di messaggistica
 *    mostrano grande invece di ridurre a francobollo;
 *  · niente moltiplicazione per la densità dello schermo: questo file non si
 *    guarda, si manda, e un file quattro volte più pesante viene ricompresso
 *    peggio, non meglio;
 *  · tutte le `y` dei testi sono LINEE DI BASE, mai bordi superiori: così il
 *    disegno non dipende dalle metriche del carattere, che cambiano da una
 *    macchina all'altra;
 *  · ⚠️ i colori si scrivono in esadecimale. Mai leggerli dalle variabili del
 *    foglio di stile: tornano come testo grezzo `oklch(...)` e dove il motore
 *    non lo interpreta l'assegnazione viene IGNORATA IN SILENZIO, disegnando
 *    col colore di prima (nero, all'inizio);
 *  · ⚠️ dopo aver impostato un carattere si rilegge: se la stringa non si
 *    lascia interpretare, l'assegnazione è ignorata in silenzio e resta
 *    `10px sans-serif`, cioè tutto il testo grande come una mosca.
 */

import { precaricaLogo } from "@/crm/biglietto";

export interface DatiAnteprimaPreventivo {
  ref: string;
  nome: string;
  cognome: string;
  totale: number;
  /** Il sistema scelto: è la riga che dice CHE COSA ha davanti il cliente. */
  base: string;
  quantita: number;
  /** Quanto costava PRIMA dello sconto. Si mostra sbarrato accanto al totale.
   *  ⚠️ Vale solo se è davvero più alto del totale: un «prezzo pieno» uguale al
   *  totale, o più basso, è un finto sconto — e un finto sconto stampato su un
   *  preventivo è una cosa che il cliente scopre e non perdona. */
  prezzoPieno?: number;
}

const L = 1200;
//  ⚠️ 675 E NON DI PIÙ, e la lezione è costata un rilascio: i programmi di
//  messaggistica RITAGLIANO l'anteprima alla loro forma, che è vicina al 16:9.
//  Portando la tela a 800 per «avere più spazio» il risultato è stato l'opposto:
//  WhatsApp ha tagliato una fascia sopra e una sotto, portandosi via il logo e
//  il numero del preventivo. Lo spazio in più non esiste — esiste solo lo
//  spazio dentro la forma che il destinatario mostra. Qui dentro si compone, e
//  il respiro si trova togliendo, non allargando.
const A = 675;
const SX = 72;
const DX = L - 72;

const COL = {
  fondo: "#081634",
  altoSfumatura: "#0c2149",
  marca: "#0f90fe",
  marcaChiara: "#8ecbff",
  bianco: "#ffffff",
} as const;

const b = (a: number) => `rgba(255,255,255,${a})`;
const PILA = '"Inter", ui-sans-serif, system-ui, sans-serif';

function font(ctx: CanvasRenderingContext2D, peso: 400 | 500 | 600 | 700, corpo: number) {
  ctx.font = `${peso} ${corpo}px ${PILA}`;
  //  ⚠️ Se l'assegnazione non ha attecchito, il disegno sarebbe illeggibile
  //  senza che nessuno se ne accorga: meglio fallire adesso e rumorosamente.
  if (ctx.font === "10px sans-serif") throw new Error("carattere non applicato");
}

const largh = (ctx: CanvasRenderingContext2D, t: string) => ctx.measureText(t).width;

function scrivi(
  ctx: CanvasRenderingContext2D,
  t: string,
  x: number,
  base: number,
  colore: string,
): number {
  ctx.fillStyle = colore;
  ctx.fillText(t, x, base);
  return largh(ctx, t);
}

/** Manda a capo misurando le parole, al massimo `righe` righe; l'ultima, se
 *  avanza roba, finisce con i puntini.
 *  ⚠️ Il carattere va impostato PRIMA di chiamarla: qui si misura soltanto.
 *  ⚠️ E si va a capo davvero, invece di tagliare: il nome del prodotto è la
 *  sola riga che dice al cliente CHE COSA ha chiesto, e vederlo mozzato su
 *  un'anteprima con mezzo biglietto vuoto sembra un errore nostro. */
function aCapo(
  ctx: CanvasRenderingContext2D,
  testo: string,
  larghezza: number,
  righe: number,
): string[] {
  const parole = String(testo || "")
    .split(/\s+/)
    .filter(Boolean);
  const out: string[] = [];
  let riga = "";
  for (const pa of parole) {
    const prova = riga ? `${riga} ${pa}` : pa;
    if (largh(ctx, prova) <= larghezza || !riga) {
      riga = prova;
      continue;
    }
    out.push(riga);
    riga = pa;
    if (out.length === righe) break;
  }
  if (out.length < righe && riga) out.push(riga);
  //  Se è avanzato qualcosa, l'ultima riga lo dichiara con i puntini.
  const usate = out.join(" ");
  if (usate.length < parole.join(" ").length && out.length) {
    let ultima = out[out.length - 1];
    while (ultima.length > 4 && largh(ctx, `${ultima}…`) > larghezza) ultima = ultima.slice(0, -1);
    out[out.length - 1] = `${ultima.trimEnd()}…`;
  }
  return out;
}

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

/** Il totale come lo legge una persona: «4.500 €», non «4500».
 *  ⚠️ Senza decimali quando non servono: «4.500,00 €» su un'anteprima è
 *  rumore, e i centesimi in un preventivo di migliaia non li guarda nessuno.
 *  Ma se ci sono, si mostrano — un totale arrotondato per estetica è un totale
 *  sbagliato. */
export function euroLeggibile(v: number): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  const interi = Math.abs(n % 1) < 0.005;
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: interi ? 0 : 2,
    maximumFractionDigits: interi ? 0 : 2,
  }).format(n);
}

/** Il nome che si stampa. ⚠️ Qui il cognome C'È, a differenza del biglietto
 *  dell'appuntamento: quel biglietto è una figura che si inoltra volentieri,
 *  questo è la scheda di un preventivo che il cliente riconosce come sua. Se
 *  il nome è lunghissimo si rimpicciolisce invece di uscire dal riquadro. */
function nomeIntero(d: DatiAnteprimaPreventivo): string {
  return [d.nome, d.cognome]
    .map((x) => String(x || "").trim())
    .filter(Boolean)
    .join(" ")
    .slice(0, 48);
}

/** ── IL LOGO ARRIVA DA DOVE ARRIVA QUELLO DEL BIGLIETTO ────────────────────
 *  ⚠️ Qui c'era un caricatore scritto apposta, che chiedeva l'immagine
 *  DIRETTAMENTE al deposito esterno. Sembrava identico all'altro e non lo era:
 *  quella richiesta è verso un'altra origine, e il browser la blocca — quindi
 *  tornava sempre `null` e la scheda ripiegava sul marchio SCRITTO. Da fuori
 *  sembrava una scelta di grafica; era una richiesta rifiutata in silenzio.
 *
 *  `precaricaLogo` (crm/biglietto) passa da un ponte interno al sito, tiene il
 *  risultato in cache e ha già i tre controlli che servono: risposta valida,
 *  tipo davvero immagine, e dimensioni intrinseche diverse da zero — senza
 *  l'ultimo, un logo vettoriale senza misure fa esplodere tutto il disegno.
 *  Un caricatore solo, in un posto solo: due copie divergono sempre, e questa
 *  era già divergente il giorno in cui è nata. */

/** ── IL DISEGNO ────────────────────────────────────────────────────────────
 *  Una gerarchia sola: il TOTALE. Sopra chi è, accanto che cosa comprende.
 *
 *  ⚠️ DUE PANNELLI GEMELLI, e non è un vezzo. Prima il totale stava dentro un
 *  riquadro e il prodotto era testo sospeso lì accanto: due cose della stessa
 *  importanza trattate in due modi diversi, che è la definizione di
 *  impaginazione caotica. Adesso sono due pannelli identici — stessa altezza,
 *  stesso vetro, stessa etichetta piccola in cima — e si leggono come una
 *  coppia. L'occhio smette di chiedersi perché uno ha la cornice e l'altro no.
 *
 *  ⚠️ E RESPIRO. La tela è più alta di un'anteprima classica proprio per
 *  questo: sul prezzo scontato ci sono tre informazioni sovrapposte (prima,
 *  adesso, quanto risparmi) e senza spazio fra loro diventano un blocco unico
 *  che non si legge. Lo spazio non è decorazione: è ciò che dice quali cose
 *  vanno lette insieme e quali separate. */
export async function disegnaAnteprimaPreventivo(
  tela: HTMLCanvasElement,
  d: DatiAnteprimaPreventivo,
): Promise<void> {
  tela.width = L;
  tela.height = A;
  const ctx = tela.getContext("2d");
  if (!ctx) throw new Error("tela non disponibile");

  //  ⚠️ Prima i caratteri, poi una sola lettera: senza questa attesa la prima
  //  generazione esce con il carattere di ripiego del sistema, e sarebbe
  //  proprio quella che finisce nella chat del cliente.
  if (document.fonts?.ready) await document.fonts.ready;

  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  // ── fondo ────────────────────────────────────────────────────────────────
  const sfumatura = ctx.createLinearGradient(0, 0, L, A);
  sfumatura.addColorStop(0, COL.altoSfumatura);
  sfumatura.addColorStop(1, COL.fondo);
  ctx.fillStyle = sfumatura;
  ctx.fillRect(0, 0, L, A);

  const alone = ctx.createRadialGradient(L - 220, 520, 20, L - 220, 520, 520);
  alone.addColorStop(0, "rgba(15,144,254,0.18)");
  alone.addColorStop(1, "rgba(15,144,254,0)");
  ctx.fillStyle = alone;
  ctx.fillRect(0, 0, L, A);

  //  ── I DUE STATI, DECISI UNA VOLTA SOLA ──────────────────────────────────
  //  Questa immagine accompagna due link che si somigliano e non c'entrano
  //  niente l'uno con l'altro:
  //   · il preventivo GIÀ FATTO, che si manda a consulenza finita — lì il
  //     protagonista è il totale, e chi apre va a rileggere una cosa decisa;
  //   · il link della consulenza mandato PRIMA, quando il preventivo non
  //     esiste ancora — lì un totale non c'è, e fingere che ci sia («0 €»,
  //     oppure una casella «TOTALE» con dentro una frase) è il modo migliore
  //     per far aprire il link a chi si aspetta un prezzo e non lo trova.
  //  Sono due composizioni diverse, non una adattata: cambia il titolo, cambia
  //  il centro della scheda, cambia perfino il numero in alto a destra — un
  //  codice di sessione stampato addosso al cliente non significa niente.
  const conTotale = Number.isFinite(Number(d.totale)) && Number(d.totale) > 0;

  // ── marchio e numero ─────────────────────────────────────────────────────
  const logo = await precaricaLogo();
  if (logo && logo.width > 0) {
    const h = 44;
    const w = Math.min(300, (logo.width / logo.height) * h);
    ctx.drawImage(logo, SX, 56, w, h);
  } else {
    font(ctx, 700, 34);
    const w = scrivi(ctx, "Hair Genius ", SX, 90, COL.bianco);
    scrivi(ctx, "Labs", SX + w, 90, COL.marca);
  }

  //  Il numero si mostra solo quando è il numero DI UN PREVENTIVO: prima che
  //  esista, `ref` è il codice della consulenza dal vivo — roba nostra, che al
  //  cliente non dice niente e sporca l'angolo più visibile della scheda.
  const rif = conTotale
    ? String(d.ref || "")
        .trim()
        .toUpperCase()
    : "";
  if (rif) {
    font(ctx, 600, 24);
    ctx.letterSpacing = "2px";
    const w = largh(ctx, rif) + 48;
    const p = riquadro(DX - w, 54, w, 46, 14);
    ctx.fillStyle = b(0.06);
    ctx.fill(p);
    ctx.strokeStyle = b(0.14);
    ctx.lineWidth = 1.5;
    ctx.stroke(p);
    scrivi(ctx, rif, DX - w + 24, 84, b(0.62));
    ctx.letterSpacing = "0px";
  }

  // ── di chi è ─────────────────────────────────────────────────────────────
  font(ctx, 500, 26);
  ctx.letterSpacing = "3px";
  scrivi(
    ctx,
    conTotale ? "PREVENTIVO SU MISURA" : "LO COSTRUIAMO INSIEME",
    SX,
    196,
    COL.marcaChiara,
  );
  ctx.letterSpacing = "0px";

  const persona = nomeIntero(d);
  if (persona) {
    let corpo = 68;
    font(ctx, 700, corpo);
    while (largh(ctx, persona) > DX - SX && corpo > 40) {
      corpo -= 4;
      font(ctx, 700, corpo);
    }
    scrivi(ctx, persona, SX, 272, COL.bianco);
  }

  const Y = 332;

  //  ── STRADA B: IL PREVENTIVO NON ESISTE ANCORA ──────────────────────────
  //  Niente casella del totale, perché non c'è un totale. Al suo posto la sola
  //  cosa vera in questo momento: che lo si costruisce insieme, adesso, e che
  //  il prezzo si muove mentre si decide. È anche la promessa che fa aprire —
  //  «guarda quanto costa» non funziona su chi non ha ancora scelto niente.
  if (!conTotale) {
    disegnaInvitoACostruire(ctx, Y);
    rigaDiChiusura(ctx, "Nessun impegno · Il prezzo lo vedi mentre scegli");
    return;
  }

  // ── i due pannelli ───────────────────────────────────────────────────────
  const totale = euroLeggibile(d.totale);
  const corpoTotale = 84;

  //  Lo sconto si mostra solo se è vero: prezzo pieno maggiore del totale di
  //  almeno un euro. Sotto quella soglia sarebbe un arrotondamento travestito
  //  da offerta, e un finto sconto su un preventivo il cliente lo scopre.
  const pieno = Number(d.prezzoPieno);
  const conSconto = Number.isFinite(pieno) && pieno - Number(d.totale) >= 1;

  const ALT = 236;
  const PAD = 40;
  const GAP = 28;

  font(ctx, 700, corpoTotale);
  const wTot = largh(ctx, totale);
  font(ctx, 400, 32);
  const testoPieno = conSconto ? euroLeggibile(pieno) : "";
  const wPieno = conSconto ? largh(ctx, testoPieno) : 0;
  font(ctx, 600, 23);
  const testoRisparmio = conSconto ? `RISPARMI ${euroLeggibile(pieno - Number(d.totale))}` : "";
  const wRisparmio = conSconto ? largh(ctx, testoRisparmio) + 34 : 0;

  const largSinistra = Math.max(wTot, wPieno + 20 + wRisparmio, 300) + PAD * 2 + 22;
  //  ⚠️ A destra NON c'è un secondo pannello, ed è una scelta rifatta due
  //  volte. Con due riquadri gemelli la scheda diventa un modulo a due caselle
  //  e il totale smette di essere il protagonista: due cornici uguali dicono
  //  «queste due cose pesano uguale», che è falso. Il totale sta nel vetro
  //  perché è il dato; il prodotto gli sta accanto in chiaro, come una
  //  didascalia. L'ottimizzazione non era mettergli una cornice: era dargli
  //  spazio e un carattere degno.

  const disegnaPannello = (x: number, larg: number) => {
    const p = riquadro(x, Y, larg, ALT, 26);
    ctx.fillStyle = b(0.055);
    ctx.fill(p);
    ctx.strokeStyle = b(0.13);
    ctx.lineWidth = 1.5;
    ctx.stroke(p);
  };

  // ── pannello del totale ──────────────────────────────────────────────────
  disegnaPannello(SX, largSinistra);
  const assicella = riquadro(SX + 28, Y + 40, 5, ALT - 80, 3);
  ctx.fillStyle = COL.marca;
  ctx.fill(assicella);

  const xS = SX + PAD + 22;
  font(ctx, 500, 25);
  ctx.letterSpacing = "3px";
  scrivi(ctx, "TOTALE", xS, Y + 56, b(0.5));
  ctx.letterSpacing = "0px";

  if (conSconto) {
    //  ⚠️ Fra il prezzo di prima e quello di adesso ci sono quasi cento pixel,
    //  non trenta: erano appiccicati e si leggevano come un numero solo
    //  spezzato in due. La riga sbarrata si disegna a mano — `line-through` su
    //  una tela non esiste — e passa a metà cifra: più in alto le taglierebbe,
    //  più in basso sembrerebbe una sottolineatura.
    const yP = Y + 116;
    font(ctx, 400, 32);
    scrivi(ctx, testoPieno, xS, yP, b(0.4));
    ctx.strokeStyle = b(0.4);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(xS - 2, yP - 10);
    ctx.lineTo(xS + wPieno + 2, yP - 10);
    ctx.stroke();

    const xR = xS + wPieno + 20;
    font(ctx, 600, 23);
    const pill = riquadro(xR, yP - 28, wRisparmio, 38, 12);
    ctx.fillStyle = "rgba(0,212,146,0.14)";
    ctx.fill(pill);
    scrivi(ctx, testoRisparmio, xR + 17, yP - 2, "#00d492");
  }

  font(ctx, 700, corpoTotale);
  scrivi(ctx, totale, xS, conSconto ? Y + 198 : Y + 168, COL.bianco);

  // ── L'INVITO AD APRIRE, AL POSTO DEL NOME DEL PRODOTTO ───────────────────
  //  ⚠️ Qui c'era il nome del prodotto («Invisible Derm Protocol», «Trapianto —
  //  i tuoi capelli, per sempre»). Il committente l'ha voluto fuori, e la
  //  ragione è buona: su un'anteprima quel nome non informa nessuno — chi la
  //  riceve ha appena finito la consulenza e sa benissimo di che si parla — e
  //  intanto occupa il posto dell'unica cosa che quell'immagine deve ottenere,
  //  cioè far APRIRE il preventivo. Un'anteprima non è un riepilogo: è un
  //  invito, e ha mezzo secondo per farsi premere.
  const xT = SX + largSinistra + GAP + 34;
  const largDestra = DX - xT;

  //  Il segno: un cerchio di vetro con dentro una freccia che esce, la stessa
  //  figura che significa «apri» in tutte le interfacce moderne. Disegnata a
  //  mano perché sulla tela non esistono icone — ma restano tre tratti, non un
  //  disegnino: a corpo piccolo un'icona complicata diventa una macchia.
  const RAGGIO = 34;
  const cx = xT + RAGGIO;
  const cy = Y + 52;
  ctx.beginPath();
  ctx.arc(cx, cy, RAGGIO, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(15,144,254,0.16)";
  ctx.fill();
  ctx.strokeStyle = "rgba(15,144,254,0.55)";
  ctx.lineWidth = 2;
  ctx.stroke();

  //  La freccia: diagonale verso l'alto a destra, come «apri in una nuova
  //  pagina». Punta e asta in un tratto solo, con gli angoli arrotondati.
  ctx.strokeStyle = COL.marcaChiara;
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(cx - 11, cy + 11);
  ctx.lineTo(cx + 11, cy - 11);
  ctx.moveTo(cx - 2, cy - 11);
  ctx.lineTo(cx + 11, cy - 11);
  ctx.lineTo(cx + 11, cy + 2);
  ctx.stroke();
  ctx.lineWidth = 1.5;

  //  Il richiamo, grande. Si rimpicciolisce solo se lo spazio non basta: è la
  //  riga che deve farsi leggere da lontano, in mezzo a una lista di chat.
  const invito = "Apri il tuo preventivo";
  let corpoInvito = 46;
  font(ctx, 700, corpoInvito);
  while (largh(ctx, invito) > largDestra && corpoInvito > 32) {
    corpoInvito -= 2;
    font(ctx, 700, corpoInvito);
  }
  scrivi(ctx, invito, xT, Y + 152, COL.bianco);

  //  Sotto, in piccolo, che cosa ci trova: toglie l'unico dubbio che frena il
  //  dito («che cos'è?») senza raccontare il preventivo, che è il lavoro del
  //  preventivo.
  font(ctx, 400, 27);
  const SOTTO = "Ogni voce nel dettaglio, con il prezzo aggiornato.";
  aCapo(ctx, SOTTO, largDestra, 2).forEach((riga, k) => {
    scrivi(ctx, riga, xT, Y + 196 + k * 36, b(0.6));
  });

  //  ⚠️ QUI NON C'È PIÙ LA RIGA DI CHIUSURA, ed è una differenza voluta fra le
  //  due schede. Su quella «da costruire» la riga serve: dice a chi non ha
  //  ancora niente in mano che aprendo non si impegna a nulla. Su questa —
  //  preventivo già fatto, totale in evidenza — «Aperto insieme al tuo
  //  consulente · Nessun pagamento adesso» è una rassicurazione che nessuno ha
  //  chiesto, e messa sotto una cifra suona come una scusa. Il committente
  //  l'ha voluta via, e ha ragione: la scheda finisce con il numero e con
  //  l'invito ad aprire, che sono le due sole cose che deve dire.
}

/** ── L'INVITO A COSTRUIRLO INSIEME ─────────────────────────────────────────
 *  La scheda del preventivo che ancora non c'è. Un pannello solo, largo quanto
 *  la scheda, con il richiamo grande e i tre passaggi sotto.
 *
 *  ⚠️ Perché non ci sono numeri, nemmeno «da 389 €»: chi riceve questo link non
 *  ha ancora scelto niente, e un prezzo qui diventa il metro con cui giudicherà
 *  tutto il resto prima di aver visto una sola opzione. La leva giusta in
 *  questo momento non è quanto costa: è che lo decide lui, con qualcuno
 *  accanto, e che può smettere quando vuole.
 *
 *  ⚠️ I tre passaggi sono verbi, non sostantivi: «Scegli», «Vedi», «Decidi».
 *  Un elenco di nomi descrive un prodotto, un elenco di verbi descrive quello
 *  che farà la persona — ed è quello che deve immaginarsi per premere. */
function disegnaInvitoACostruire(ctx: CanvasRenderingContext2D, Y: number) {
  const ALT = 236;
  const PAD = 44;

  const pannello = riquadro(SX, Y, DX - SX, ALT, 26);
  ctx.fillStyle = b(0.055);
  ctx.fill(pannello);
  ctx.strokeStyle = b(0.13);
  ctx.lineWidth = 1.5;
  ctx.stroke(pannello);

  //  ⚠️ Il segno: tre cursori, non due figurine.
  //  Ci avevo messo due sagome affiancate per dire «insieme»: a questa
  //  dimensione i due cerchietti con sotto le curve leggono come una faccia con
  //  gli occhiali, non come due persone. I cursori invece dicono in un colpo
  //  solo la cosa vera — qui si regola, si sceglie, si compone — e restano
  //  leggibili anche in un'anteprima larga tre centimetri.
  const R = 36;
  const cx = SX + PAD + R;
  const cy = Y + 76;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(15,144,254,0.16)";
  ctx.fill();
  ctx.strokeStyle = "rgba(15,144,254,0.55)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.strokeStyle = COL.marcaChiara;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  //  Tre binari orizzontali con la manopola in tre posizioni diverse: la
  //  differenza di posizione è ciò che fa capire che si possono muovere.
  [
    { y: -13, k: 6 },
    { y: 0, k: -5 },
    { y: 13, k: 10 },
  ].forEach(({ y, k }) => {
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - 16, cy + y);
    ctx.lineTo(cx + 16, cy + y);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx + k, cy + y, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = COL.marcaChiara;
    ctx.fill();
  });
  ctx.lineWidth = 1.5;

  const xT = SX + PAD + R * 2 + 30;
  const largT = DX - PAD - xT;

  //  Il richiamo. È la riga che deve leggersi da lontano, in mezzo a una lista
  //  di chat: si rimpicciolisce solo se lo spazio non basta davvero.
  const invito = "Apri e costruiamolo insieme";
  let corpo = 52;
  font(ctx, 700, corpo);
  while (largh(ctx, invito) > largT && corpo > 36) {
    corpo -= 2;
    font(ctx, 700, corpo);
  }
  scrivi(ctx, invito, xT, Y + 80, COL.bianco);

  font(ctx, 400, 28);
  aCapo(ctx, "Scegli tu ogni dettaglio: il prezzo si aggiorna mentre decidi.", largT, 2).forEach(
    (riga, k) => scrivi(ctx, riga, xT, Y + 126 + k * 38, b(0.62)),
  );

  //  I tre passaggi, in fondo al pannello: pastiglie piccole, numerate, che
  //  raccontano l'incontro in cinque parole.
  const passi = ["1 · Scegli", "2 · Vedi il prezzo", "3 · Decidi con calma"];
  let px = xT;
  font(ctx, 600, 24);
  passi.forEach((testo) => {
    const w = largh(ctx, testo) + 40;
    if (px + w > DX - PAD) return;
    const p = riquadro(px, Y + ALT - 76, w, 46, 14);
    ctx.fillStyle = b(0.05);
    ctx.fill(p);
    ctx.strokeStyle = b(0.12);
    ctx.lineWidth = 1.5;
    ctx.stroke(p);
    font(ctx, 600, 24);
    scrivi(ctx, testo, px + 20, Y + ALT - 45, b(0.72));
    px += w + 14;
  });
}

/** La riga in fondo, uguale nelle due strade tranne che nelle parole. */
function rigaDiChiusura(ctx: CanvasRenderingContext2D, testo: string) {
  ctx.fillStyle = b(0.1);
  ctx.fillRect(SX, A - 96, DX - SX, 2);
  font(ctx, 400, 26);
  scrivi(ctx, testo, SX, A - 46, b(0.55));
}

/** Disegna, rimpicciolisce e deposita: l'anteprima di questo preventivo.
 *
 *  ⚠️ Non dice mai niente a schermo, né quando riesce né quando fallisce.
 *  Succede da sola mentre il consulente sta guardando il preventivo appena
 *  confermato: un avviso qui lo distrarrebbe da una cosa che non ha chiesto, e
 *  se non riesce il link funziona lo stesso — l'anteprima ricade sul marchio
 *  dello studio. */
export async function depositaAnteprimaPreventivo(d: DatiAnteprimaPreventivo): Promise<void> {
  try {
    const tela = document.createElement("canvas");
    await disegnaAnteprimaPreventivo(tela, d);
    const blob = await new Promise<Blob | null>((ris) =>
      tela.toBlob((x) => ris(x), "image/jpeg", 0.86),
    );
    if (!blob) return;
    const modulo = new FormData();
    modulo.append("tipo", "preventivo");
    modulo.append("codice", d.ref);
    modulo.append("file", blob, `preventivo-${d.ref}.jpg`);
    await fetch("/api/anteprima", { method: "POST", body: modulo });
  } catch {
    /* resta il marchio dello studio */
  }
}
