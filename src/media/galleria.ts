// ── RACCOLTE MEDIA — LE REGOLE COMUNI ───────────────────────────────────────
//  Una "raccolta" è un elenco ORDINATO di media che vive dietro un link
//  statico: niente consulenza, niente consulente collegato, niente sessione.
//  Il link si manda e basta, e chi lo apre scorre le foto.
//
//  Questo file non conosce né il database né il browser: sono solo la forma
//  della raccolta e le regole del codice. Serve a tutti e tre i lati (chi
//  crea, chi legge, chi disegna la pagina) senza trascinarsi dietro Supabase
//  nel pacchetto inviato al browser.

export type TipoMedia = "video" | "image";

/** Una voce della raccolta. `nome` non si mostra al cliente — serve al
 *  consulente quando riguarda cosa aveva messo in un link — ma viaggia con la
 *  voce perché una raccolta deve restare leggibile anche se il media viene poi
 *  rinominato o tolto dalla libreria. */
export interface VoceGalleria {
  url: string;
  kind: TipoMedia;
  nome: string;
}

export interface Galleria {
  codice: string;
  titolo?: string;
  voci: VoceGalleria[];
  creataIl: string;
}

// ── ANTEPRIMA DI UN VIDEO SENZA GENERARE NULLA ──────────────────────────────
//  Un video che si presenta come un rettangolo nero sembra rotto e non lo apre
//  nessuno. Il primo fotogramma si ottiene puntando l'elemento al primo istante
//  con il frammento `#t=0.1`: il browser scarica solo i metadati, si ferma lì e
//  disegna quel fotogramma come immagine ferma. Nessun file generato, nessuna
//  colonna in più, nessuno spazio occupato — funziona perché lo Storage risponde
//  alle richieste parziali (senza Range il browser non potrebbe fermarsi).
//  Va usato SEMPRE insieme a preload="metadata" e playsInline.
//
//  ⚠️ Si taglia via un eventuale frammento già presente: `file.mp4#t=5` + `#t=0.1`
//  darebbe un indirizzo con due frammenti, cioè nessuno dei due.
//  (La stessa riga vive anche in src/routes/presenta.tsx, che è di un altro
//  proprietario: quando quel file potrà essere toccato, importerà questa.)
export const conPrimoFotogramma = (url: string) => `${url.split("#")[0]}#t=0.1`;

// ── IL CODICE È LA CHIAVE, QUINDI SI SORTEGGIA ──────────────────────────────
//  Chi ha il codice vede le foto: non c'è nessun altro controllo, ed è voluto
//  (il cliente non deve fare l'accesso da nessuna parte). Ne segue che il
//  codice NON può essere un contatore né una data: sarebbero indovinabili
//  provando i numeri vicini, e da un link mandato a un cliente si arriverebbe
//  alle foto di tutti gli altri. Qui si sorteggia con il generatore
//  crittografico, 12 caratteri = più di 10.000.000.000.000.000 combinazioni.
//
//  L'alfabeto esclude tutte le coppie che si confondono quando un link si
//  detta al telefono o si trascrive da uno schermo: O/0, I/1/L, S/5, B/8,
//  Z/2, G/6, Q/O. Restano 23 segni che non hanno un sosia.
export const ALFABETO = "ACDEFHJKMNPRTUVWXY34679";
const LUNGHEZZA = 12;
/** Il resto della divisione introduce una preferenza per i primi segni
 *  dell'alfabeto (256 non è multiplo di 23): i byte oltre l'ultimo multiplo
 *  intero si buttano e si ripesca. Un sorteggio storto è un sorteggio più
 *  facile da indovinare. */
const SOGLIA_BYTE = Math.floor(256 / ALFABETO.length) * ALFABETO.length;

/** Il codice come si salva: 12 segni, senza trattini. */
export function generaCodice(): string {
  let out = "";
  while (out.length < LUNGHEZZA) {
    const b = new Uint8Array(LUNGHEZZA * 2);
    crypto.getRandomValues(b);
    for (const x of b) {
      if (x >= SOGLIA_BYTE) continue;
      out += ALFABETO[x % ALFABETO.length];
      if (out.length === LUNGHEZZA) break;
    }
  }
  return out;
}

/** Il codice come si legge e si detta: gruppi di quattro.
 *  "ACDEF3HJKMN7" → "ACDE-F3HJ-KMN7" */
export function formattaCodice(codice: string): string {
  return (codice.match(/.{1,4}/g) ?? [codice]).join("-");
}

/** Da quello che arriva (indirizzo, parametro, incollato a mano) al codice
 *  vero, oppure stringa vuota.
 *  Si tollerano minuscole, trattini e spazi — chi ricopia un link a mano fa
 *  esattamente questi tre errori — ma NON si "aggiusta" un segno che non
 *  esiste nell'alfabeto: sarebbe indovinare al posto del cliente, e si
 *  finirebbe per aprire la raccolta di qualcun altro. Un codice trascritto
 *  male porta alla schermata gentile, che è la risposta giusta. */
export function codicePulito(v: unknown): string {
  const s = String(v ?? "")
    .toUpperCase()
    .replace(/[\s-]/g, "");
  if (s.length !== LUNGHEZZA) return "";
  for (const c of s) if (!ALFABETO.includes(c)) return "";
  return s;
}

/** Il codice letto dall'indirizzo della pagina pubblica (/media/ACDE-F3HJ-KMN7).
 *  Si legge dal percorso e non dai parametri della rotta per lo stesso motivo
 *  per cui lo fa già la stanza Meetly (`codiceDaIndirizzo` in src/shop/live.ts):
 *  è un punto solo, funziona anche prima che il router abbia deciso qualcosa, e
 *  non cambia se un giorno l'indirizzo viene affiancato da una forma vecchia. */
const PERCORSO_RE = /\/media\/([^/?#]+)/i;
export function codiceDaPercorso(pathname: string): string {
  const m = PERCORSO_RE.exec(pathname || "");
  if (!m) return "";
  let grezzo = m[1];
  try {
    grezzo = decodeURIComponent(m[1]);
  } catch {
    /* percentuali storte: si prende com'è */
  }
  return codicePulito(grezzo);
}

/** La chiave in app_config. Una riga per raccolta (vedi il commento nella
 *  rotta): il codice ci finisce dentro, quindi passa SEMPRE da `codicePulito`. */
export const chiaveGalleria = (codice: string) => `galleria:${codice}`;
export const PREFISSO_GALLERIA = "galleria:";

/** Quante voci può contenere un link. Non è un limite tecnico: è che una
 *  raccolta di cento foto non la guarda nessuno fino in fondo, e app_config
 *  non è il posto dove far crescere una stringa senza limiti. */
export const MAX_VOCI = 60;
export const MAX_TITOLO = 80;
const MAX_NOME = 120;
/** Un indirizzo più lungo di così non è un indirizzo: è un media incollato
 *  dentro il link (`data:image/jpeg;base64,…`). Sessanta di quelli e la riga in
 *  app_config diventa decine di megabyte, che poi vanno lette a ogni apertura
 *  dal telefono di un cliente. Si SCARTA e non si taglia: un indirizzo tagliato
 *  è un indirizzo rotto, e una diapositiva vuota è peggio di una in meno. */
const MAX_URL = 2000;

// ── CIÒ CHE È SALVATO NON È UN TIPO ─────────────────────────────────────────
//  Stessa lezione della libreria media: quello che torna dal database (o dalla
//  rete) è una stringa di cui ci si fida, scritta anche da versioni precedenti
//  e modificabile a mano dal pannello Supabase. Può non essere un array, o
//  contenere voci nulle o senza indirizzo. Una sola voce malformata non deve
//  lasciare il cliente davanti a una pagina bianca: si scarta l'inutilizzabile.
export function normalizzaVoci(x: unknown): VoceGalleria[] {
  if (!Array.isArray(x)) return [];
  return x
    .filter((v): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v))
    .filter(
      (v) => typeof v.url === "string" && v.url.trim() !== "" && v.url.trim().length <= MAX_URL,
    )
    .map((v) => ({
      url: String(v.url).trim(),
      kind: (v.kind === "image" ? "image" : "video") as TipoMedia,
      nome:
        typeof v.nome === "string" && v.nome.trim() ? v.nome.trim().slice(0, MAX_NOME) : "Media",
    }))
    .slice(0, MAX_VOCI);
}

/** La raccolta intera, ripulita. `null` = non c'è niente da mostrare, e chi
 *  chiama deve trattarla come "link non più valido". */
export function normalizzaGalleria(grezzo: unknown, codice: string): Galleria | null {
  if (!grezzo || typeof grezzo !== "object" || Array.isArray(grezzo)) return null;
  const g = grezzo as Record<string, unknown>;
  const voci = normalizzaVoci(g.voci);
  if (!voci.length) return null;
  const titolo =
    typeof g.titolo === "string" && g.titolo.trim()
      ? g.titolo.trim().slice(0, MAX_TITOLO)
      : undefined;
  return {
    codice,
    titolo,
    voci,
    creataIl: typeof g.creataIl === "string" ? g.creataIl : "",
  };
}
