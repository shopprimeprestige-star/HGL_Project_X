/** ── LA CHAT WHATSAPP · RICONOSCERE MEDIA E SEGNAPOSTO ─────────────────────
 *
 *  Commessa 2026-10-28 (chat WhatsApp nel CRM). Funzioni PURE: niente React,
 *  niente Supabase, niente `@/integrations` (così `prove/prove.mjs` le
 *  impacchetta con la voce `chatwa/media`). Prove in `prove/manychat/chat-media.mjs`.
 *
 *  ⚠️ Il testo lo scrive il cliente su una rotta pubblica: nessuna regex con un
 *   quantificatore dentro un quantificatore (ReDoS, R1). Le regex di questo file,
 *   controllate a mano una per una:
 *    - SEGNAPOSTO  `^\s*(\{\{[^{}]*\}\}\s*)+$`: ogni giro comincia con `{`, che `\s`
 *      e `[^{}]` non possono mangiare, quindi non c'è più di un modo di spezzare il testo;
 *    - RIGA_SOLA   `^[\x21-\x7e]+$`: un solo quantificatore;
 *    - PERCORSO    `^/[^/]+/wa/\d{4}/\d{2}/\d{2}/[^/]+$`: i `[^/]+` non mangiano mai `/`;
 *    - VOCALE_CON_DURATA  `^Vocale \d{1,3}:[0-5]\d$`: ancorata, quantificatori su cifre con i due punti in mezzo;
 *    - le altre sono lettere e basta. Le prove misurano il tempo (sotto 50 ms).
 *  ⚠️ Un link è un media solo se è TUTTO il testo e passa ogni controllo in
 *   ordine (D14, R8): nel dubbio resta testo, mai un link né un `src`.
 *  ───────────────────────────────────────────────────────────────────────── */

/** Host da cui si accettano i media di ManyChat (lista chiusa, D14). */
export const HOST_MEDIA_AMMESSI: readonly string[] = [
  "manybot-files.s3.eu-central-1.amazonaws.com",
  "manybot-files.s3.amazonaws.com",
];

export type TipoTesto =
  | "testo"
  | "audio"
  | "immagine"
  | "video"
  | "documento"
  | "allegato"
  | "illeggibile";

export interface TestoClassificato {
  tipo: TipoTesto;
  /** `url.href` normalizzato: solo per i media riconosciuti. */
  url?: string;
  /** Cosa si scrive nella bolla/anteprima («Vocale» con la sua icona, «Reazione, sticker o posizione: aprila in ManyChat»…). */
  etichetta: string;
}

export const ETICHETTA_ILLEGGIBILE = "Reazione, sticker o posizione: aprila in ManyChat";
/** Quello che `risposta.ts` scrive nella riga quando il cliente non ha mandato testo. */
const SENZA_TESTO = "[messaggio senza testo]";

const SEGNAPOSTO = /^\s*(\{\{[^{}]*\}\}\s*)+$/;
/** Una riga sola di caratteri ASCII visibili: niente spazi, tab, a capo, controlli. */
const RIGA_SOLA = /^[\x21-\x7e]+$/;
/** La forma vista dal vivo: /<pagina>/wa/AAAA/MM/GG/<file> (il bucket è di ManyChat, condiviso). */
const PERCORSO = /^\/[^/]+\/wa\/\d{4}\/\d{2}\/\d{2}\/[^/]+$/;
const SCHEMA_HTTPS = "https://";

const ESTENSIONI: Record<string, Exclude<TipoTesto, "testo" | "illeggibile">> = {
  ogg: "audio",
  oga: "audio",
  mp3: "audio",
  m4a: "audio",
  opus: "audio",
  aac: "audio",
  amr: "audio",
  jpg: "immagine",
  jpeg: "immagine",
  png: "immagine",
  webp: "immagine",
  mp4: "video",
  pdf: "documento",
};

//  Senza emoji (28/10/2026, richiesta del titolare): l'icona la mette chi
//  disegna (chatwa/IconaMedia), con lo stesso stile outline del resto del CRM.
const ETICHETTE: Record<string, string> = {
  audio: "Vocale",
  immagine: "Foto",
  video: "Video",
  documento: "Documento",
  allegato: "Allegato",
};

/** «Vocale 0:12»: il ponte WhatsApp scrive la durata dopo l'etichetta (minuti da 1 a 3 cifre, secondi 00-59). */
const VOCALE_CON_DURATA = new RegExp(`^${ETICHETTE.audio} \\d{1,3}:[0-5]\\d$`);

/** Le emoji che le anteprime salvate PRIMA del 28/10 hanno ancora davanti. */
const EMOJI_VECCHIE = /^(?:🎤|📷|🎥|📎)\uFE0F?\s*/u;

/** Un'anteprima (anche salvata in archivio) è un media? Ne dice il tipo e il
 *  testo pulito dall'emoji vecchia; per un testo normale `tipo` è null. */
type TipoMedia = "audio" | "immagine" | "video" | "documento" | "allegato";

export function mediaInAnteprima(testo: string | null | undefined): {
  tipo: TipoMedia | null;
  testo: string;
} {
  const t = String(testo ?? "");
  //  ⚠️ L'emoji si toglie SOLO se resta un'etichetta nostra: «📷 ecco la foto
  //   della nuca» l'ha scritto il cliente e resta com'è (revisione del 28/10).
  const pulito = t.replace(EMOJI_VECCHIE, "");
  const tipo =
    (Object.keys(ETICHETTE) as TipoMedia[]).find((k) => ETICHETTE[k] === pulito) ??
    (VOCALE_CON_DURATA.test(pulito) ? "audio" : undefined);
  return tipo ? { tipo, testo: pulito } : { tipo: null, testo: t };
}

/** Il testo è un link di media ammesso? Restituisce tipo e `url.href`, altrimenti niente. */
function leggiMedia(t: string): { tipo: TipoTesto; url: string } | null {
  // 1. stringa GREZZA: una riga, nessuno spazio/tab/a capo/controllo, niente backslash né `#`
  //    (il parser di URL toglie tab e a capo e cambia i backslash in barre: dopo sarebbe tardi).
  if (!RIGA_SOLA.test(t) || t.includes("\\") || t.includes("#")) return null;
  // 2. schema https (anche scritto maiuscolo) e host esatto, letto dalla stringa grezza:
  //    così `user@`, `:porta` (anche la 443, che il parser toglierebbe) e il punto finale cadono.
  if (t.slice(0, SCHEMA_HTTPS.length).toLowerCase() !== SCHEMA_HTTPS) return null;
  const resto = t.slice(SCHEMA_HTTPS.length);
  const fine = resto.search(/[/?]/);
  const autorita = (fine < 0 ? resto : resto.slice(0, fine)).toLowerCase();
  if (!HOST_MEDIA_AMMESSI.includes(autorita)) return null;
  let url: URL;
  try {
    url = new URL(t);
  } catch {
    return null;
  }
  // Cintura e bretelle (ponytail): col controllo grezzo qui sopra questi sono già coperti; restano come
  // difesa in profondità se qualcuno allenta il passo 1 o 2. Non toglierli credendoli superflui.
  if (
    url.protocol !== "https:" ||
    url.hostname !== autorita ||
    url.port ||
    url.username ||
    url.password ||
    url.hash
  )
    return null;
  // 3. il percorso (già normalizzato dal parser: i `..` sono spariti) ha la forma attesa, senza %2e %2f %5c.
  if (!PERCORSO.test(url.pathname) || /%2e|%2f|%5c/i.test(url.pathname)) return null;
  // 4. il tipo viene dall'estensione del file, in minuscolo.
  const file = url.pathname.slice(url.pathname.lastIndexOf("/") + 1);
  const punto = file.lastIndexOf(".");
  const tipo = (punto >= 0 && ESTENSIONI[file.slice(punto + 1).toLowerCase()]) || "allegato";
  return { tipo, url: url.href };
}

/** Che cos'è un testo arrivato dal cliente: parole, un media o un messaggio illeggibile. */
export function classificaTesto(testo: string): TestoClassificato {
  if (typeof testo !== "string") return { tipo: "testo", etichetta: "" };
  const t = testo.trim();
  if (t === SENZA_TESTO || SEGNAPOSTO.test(t))
    return { tipo: "illeggibile", etichetta: ETICHETTA_ILLEGGIBILE };
  const media = leggiMedia(t);
  if (media) return { tipo: media.tipo, url: media.url, etichetta: ETICHETTE[media.tipo] };
  return { tipo: "testo", etichetta: testo };
}

/** L'anteprima di un'entrata è quella del messaggio che ManyChat non sa leggere? */
export function eAnteprimaIlleggibile(anteprima: string | null | undefined): boolean {
  return anteprima === ETICHETTA_ILLEGGIBILE;
}

/** Il testo è fatto SOLO di segnaposto non risolti (`{{x}}`)? Vuoto = no. */
export function eSoloSegnaposto(testo: string): boolean {
  return typeof testo === "string" && SEGNAPOSTO.test(testo);
}

const MAX_ANTEPRIMA = 100;
/** Quanto testo guardare al massimo prima di tagliare: basta e avanza per 100 caratteri. */
const MAX_LETTURA = 2000;

/** L'anteprima di un messaggio in entrata, per l'elenco (≤ 100 caratteri, D10). */
export function anteprimaIn(testo: string): string {
  if (typeof testo !== "string") return "";
  const c = classificaTesto(testo);
  if (c.tipo !== "testo") return c.etichetta;
  if (testo.length <= MAX_ANTEPRIMA) return testo;
  // Si taglia per «caratteri come li vede l'occhio» (emoji con ZWJ, bandiere), non per unità di testo.
  const inizio = testo.slice(0, MAX_LETTURA);
  const pezzi: string[] =
    typeof Intl !== "undefined" && "Segmenter" in Intl
      ? Array.from(
          new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(inizio),
          (s) => s.segment,
        )
      : Array.from(inizio);
  if (pezzi.length <= MAX_ANTEPRIMA && testo.length <= MAX_LETTURA) return testo;
  return pezzi.slice(0, MAX_ANTEPRIMA).join("") + "…";
}
