// ── L'IMMAGINE PERSONALE IN TESTA AI MODELLI UTILITY ────────────────────────
//  Commessa 2026-10-31-modelli-utility. I modelli WhatsApp col link del meet (conferma, promemoria,
//  «meet adesso»…) hanno un'immagine in testa che è DIVERSA PER OGNI CLIENTE: «Mario» vede l'immagine
//  con «Mario». A ogni invio il CRM passa a Meta (o a ManyChat, nel campo `crm_img`) l'indirizzo di
//  quella immagine: `/api/og/anteprima/modello/<codice-meet>_<gettone>.jpg`.
//
//  ⚠️ NON È IL BIGLIETTO DI MEETLY (`biglietto.ts`): quello mostra le tre soluzioni, «preventivo su
//   misura» e simili, e un modello Utility con quell'immagine rischia di essere riclassificato
//   Marketing. Questa porta SOLO: «Hair Genius Labs», «Consulenza Hair Genius Labs», nome di battesimo,
//   giorno, ora, consulente. Niente telefono, durata, link, importi, prodotti, parole di vendita.
//   La lista è la stessa dei sei campi che l'invito pubblico già espone (vedi `biglietto.ts`), meno
//   quelli che non servono: chi aggiunge una riga qui la pubblica su internet.
//
//  ⚠️ SI DISEGNA NEL BROWSER (Canvas 2D), come il biglietto: il server (Cloudflare Workers) non ha né una
//   tela né i caratteri (vedi `api.anteprima.ts`). Si deposita nello stesso momento in cui nasce la
//   stanza (`anteprima-link.ts`), sotto il codice PERSONALE (stanza + gettone di chi riceve il link):
//   quello della sola stanza porterebbe il nome di un altro cliente. Se il browser non la deposita,
//   nessuno la serve e il modello nuovo non parte (parte il vecchio): vedi `porta.ts`.
//  Le misure sono per Meta: JPEG o PNG, sotto 5 MB, https pubblico. 1200×630, JPEG ~100 KB.
import { codiceAnteprimaDi, spezzaCodiceAnteprima } from "@/shop/chi-dal-link";
import { codiceImmagineModello } from "./wa-meta-templates";
import { giornoPerEsteso, oraPulita } from "./invito";

export const LARGHEZZA = 1200;
export const ALTEZZA = 630;
export const TIPO_FILE = "image/jpeg";
/** Il tetto di Meta per le immagini dei modelli è 5 MB; il nostro JPEG ne pesa un centesimo. */
export const PESO_MASSIMO_BYTE = 5 * 1024 * 1024;

/** I soli dati che servono. Tutto il resto del biglietto (telefono, durata, link) NON si legge. */
export interface DatiBigliettoModello {
  /** nome di battesimo, già ripulito */
  nome: string;
  /** aaaa-mm-gg */
  giorno: string;
  /** hh:mm */
  ora: string;
  consulente?: string;
  /** il codice della stanza Meetly */
  stanza?: string;
  /** il gettone di chi riceve il link (vedi `shop/chi-dal-link`) */
  gettone?: string;
}

/** Una riga dell'immagine: il testo e come disegnarla (le stesse per il browser e per l'esempio di Meta). */
export interface RigaModello {
  testo: string;
  x: number;
  y: number;
  /** altezza del carattere in pixel */
  dimensione: number;
  peso: 400 | 600 | 700;
  colore: string;
}

/** Il codice sotto cui si deposita e si cerca l'immagine: stanza + gettone di chi riceve il link.
 *  Stringa vuota se il gettone manca o non è valido (mai l'immagine della sola stanza). */
export function codiceImmaginePersonale(d: Pick<DatiBigliettoModello, "stanza" | "gettone">): string {
  const stanza = String(d.stanza ?? "").trim();
  if (!stanza) return "";
  const codice = codiceImmagineModello(codiceAnteprimaDi(stanza, d.gettone));
  return spezzaCodiceAnteprima(codice).gettone ? codice : "";
}

/** Le righe dell'immagine, o `null` se non si può fare un'immagine onesta: senza nome, giorno, ora o
 *  gettone un'immagine che dice «alle ore —» o porta il nome sbagliato è peggio di nessuna. */
export function righeBigliettoModello(d: DatiBigliettoModello): RigaModello[] | null {
  const nome = String(d.nome ?? "").trim();
  const giorno = giornoPerEsteso({ data: String(d.giorno ?? "") } as Parameters<typeof giornoPerEsteso>[0]);
  const ora = oraPulita(d.ora);
  if (!nome || !giorno || !ora || !codiceImmaginePersonale(d)) return null;
  const consulente = String(d.consulente ?? "").trim();
  const X = 88;
  const righe: RigaModello[] = [
    { testo: "Hair Genius Labs", x: X, y: 96, dimensione: 34, peso: 700, colore: "#ffffff" },
    { testo: "Consulenza Hair Genius Labs", x: X, y: 200, dimensione: 40, peso: 600, colore: "#93c5fd" },
    { testo: nome, x: X, y: 320, dimensione: 104, peso: 700, colore: "#ffffff" },
    { testo: giorno, x: X, y: 420, dimensione: 48, peso: 600, colore: "#e2e8f0" },
    { testo: `Ore ${ora}`, x: X, y: 490, dimensione: 48, peso: 600, colore: "#e2e8f0" },
  ];
  if (consulente)
    righe.push({ testo: `Con ${consulente}`, x: X, y: 556, dimensione: 38, peso: 400, colore: "#94a3b8" });
  return righe;
}

/** Disegna l'immagine su una tela 1200×630 (solo nel browser). Fondo del marchio, nessun logo
 *  scaricato: l'immagine deve essere pronta subito, anche fuori schermo. Ritorna `false` se non si può
 *  disegnare (dati mancanti): chi chiama non deposita niente. */
export function disegnaBigliettoModello(canvas: HTMLCanvasElement, d: DatiBigliettoModello): boolean {
  const righe = righeBigliettoModello(d);
  if (!righe) return false;
  canvas.width = LARGHEZZA;
  canvas.height = ALTEZZA;
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;
  const fondo = ctx.createLinearGradient(0, 0, LARGHEZZA, ALTEZZA);
  fondo.addColorStop(0, "#081634");
  fondo.addColorStop(1, "#050f24");
  ctx.fillStyle = fondo;
  ctx.fillRect(0, 0, LARGHEZZA, ALTEZZA);
  ctx.fillStyle = "#3b82f6";
  ctx.fillRect(0, 0, LARGHEZZA, 6);
  ctx.textBaseline = "alphabetic";
  for (const r of righe) {
    ctx.font = `${r.peso} ${r.dimensione}px Inter, system-ui, -apple-system, "Segoe UI", sans-serif`;
    ctx.fillStyle = r.colore;
    ctx.fillText(r.testo, r.x, r.y, LARGHEZZA - 2 * r.x);
  }
  return true;
}
