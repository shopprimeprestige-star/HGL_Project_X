/** ── PORTAFOGLIO FOTO E VIDEO DEL CLIENTE · I DATI, PRIMA DELLA GRAFICA ────
 *
 *  PERCHÉ UN FILE A PARTE
 *  Il portafoglio si legge in sei posti diversi — le quattro righe delle
 *  installazioni, la scheda del cliente, la finestra del carosello — e si
 *  scrive in uno solo. Se la regola «qual è la principale» vivesse dentro i
 *  componenti, il pulsante nell'elenco di oggi mostrerebbe una foto e quello
 *  nella scheda a domicilio un'altra, sulla stessa persona: la stessa lezione
 *  di crm/spedizione.ts, dove due regole gemelle facevano risultare una riga
 *  insieme «pronta da spedire» e «senza indirizzo».
 *
 *  QUI DENTRO NON C'È NÉ RETE NÉ DATABASE NÉ REACT. Sono funzioni che
 *  ricevono un lead (o un portafoglio) e restituiscono un portafoglio nuovo.
 *  Chi scrive davvero — cioè chi chiama `updateLead` e mostra il messaggio con
 *  «Annulla» — sta nello strato di sopra, che è React e sa parlare col CRM.
 *  Il vantaggio è che queste regole si possono leggere tutte insieme, in una
 *  schermata, e che il caricamento del file (routes/api.crm.media-upload.ts)
 *  può riusarne i controlli sul tipo senza tirarsi dietro il CRM.
 *
 *  ── LE TRE REGOLE DELLA PRINCIPALE, CHE VIVONO SOLO QUI ───────────────────
 *   1. LA PRINCIPALE È UNA SOLA. Non è un interruttore per voce (due accesi
 *      insieme e nessuno sa quale mostrare): è UN campo, `copertinaId`, quindi
 *      sceglierne un'altra spegne la precedente da sé, senza codice.
 *   2. SE NESSUNA È SCELTA VALE LA PRIMA FOTO. Il ripiego si CALCOLA a ogni
 *      lettura e non si scrive: scriverlo vorrebbe dire che riordinare
 *      l'elenco lascia indietro una principale che nessuno ha scelto.
 *   3. UN VIDEO NON PUÒ ESSERE LA PRINCIPALE. L'anteprima di un video è il suo
 *      primo fotogramma (conPrimoFotogramma in media/galleria.ts), e su un
 *      quadratino di 28 pixel è quasi sempre nero: un pulsante nero non dice a
 *      nessuno che dietro c'è qualcosa. Un fermo immagine vero non lo abbiamo —
 *      nessuno lo genera, e generarlo qui vorrebbe dire disegnare su una tela
 *      che nel Worker non esiste. Quindi si rifiuta, e si DICE perché.
 *      Conseguenza da tenere presente: un portafoglio fatto di soli video non
 *      ha nessuna principale, e `principaleDi` restituisce null. Chi disegna il
 *      pulsante deve avere un'icona per quel caso, non una foto vuota.
 *
 *  ── ⚠️ TOGLIERE UNA VOCE NON CANCELLA IL FILE ────────────────────────────
 *  Vedi `senzaVoce`, in fondo: è la cosa più importante scritta in questo file
 *  e riguarda foto di persone.
 *  ───────────────────────────────────────────────────────────────────────── */

import { MAX_VOCI, normalizzaVoci, type TipoMedia, type VoceGalleria } from "@/media/galleria";
import type { Lead, MediaCliente, MediaClienteInfo } from "@/crm/types";

/* ═══════════════════════════════════════════════════════════════════════════
   1. CHE COSA SI PUÒ CARICARE — le regole le legge anche il server
   ═════════════════════════════════════════════════════════════════════════ */

/** ── I TIPI AMMESSI, E PERCHÉ È UN ELENCO CHIUSO ──────────────────────────
 *  L'estensione dell'indirizzo pubblico si ricava DA QUI e non dal nome del
 *  file che arriva dal telefono: il nome originale non deve finire nell'url
 *  (vedi il commento su MediaCliente in crm/types.ts), e un'estensione
 *  ricopiata da un nome è anche un modo per farsi scrivere `.html` nello
 *  spazio pubblico del centro.
 *  Elenco chiuso e non `image/*`: ciò che non è qui dentro non ha
 *  un'estensione da dargli, e un file salvato senza estensione è un file che
 *  il browser scarica invece di mostrare.
 *
 *  ⚠️ HEIC NON C'È, ED È UNA SCELTA. È il formato con cui gli iPhone salvano
 *   le foto, ma nessun browser lo disegna: accettarlo significa mettere in
 *   archivio un file che nella scheda resta un rettangolo rotto, e nessuno
 *   capirebbe perché. Nella pratica non si perde quasi niente — scegliendo la
 *   foto dalla galleria, iOS la converte da sé in JPEG — e quando capita si
 *   rifiuta DICENDO cosa fare (vedi MOTIVO_TIPO). È una riga da togliere il
 *   giorno in cui qualcuno converte i file al volo. */
export const TIPI_AMMESSI: Record<string, { kind: TipoMedia; estensione: string }> = {
  "image/jpeg": { kind: "image", estensione: "jpg" },
  "image/jpg": { kind: "image", estensione: "jpg" },
  "image/png": { kind: "image", estensione: "png" },
  "image/webp": { kind: "image", estensione: "webp" },
  "image/gif": { kind: "image", estensione: "gif" },
  "video/mp4": { kind: "video", estensione: "mp4" },
  "video/quicktime": { kind: "video", estensione: "mov" },
  "video/webm": { kind: "video", estensione: "webm" },
};

/** ── QUANTO PUÒ PESARE ────────────────────────────────────────────────────
 *  Due tetti diversi perché sono due cose diverse: una foto di venticinque
 *  mega non è una foto, è uno sbaglio; un video di posa girato col telefono
 *  arriva tranquillamente a qualche centinaio.
 *  ⚠️ QUESTO È IL TETTO DICHIARATO, NON QUELLO IMPOSTO. Il peso che il server
 *   controlla è quello che il browser gli DICE, e si può mentire. Il tetto vero
 *   e non aggirabile è quello del bucket (`fileSizeLimit`), che lo Storage
 *   applica sul file vero: sta in routes/api.crm.media-upload.ts, ed è più
 *   largo di questi due apposta — serve a fermare gli abusi, non a fare da
 *   controllo di qualità. Questi due invece servono a dirlo PRIMA, con una
 *   frase che si capisce, invece di far caricare per tre minuti un file che
 *   verrà rifiutato alla fine. */
export const LIMITE_FOTO = 25 * 1024 * 1024;
export const LIMITE_VIDEO = 500 * 1024 * 1024;

const mb = (n: number) => Math.round(n / (1024 * 1024));

/** Il tipo di media, oppure `null` se non è roba da portafoglio.
 *  Si guarda SOLO il tipo dichiarato dal browser: il nome del file non entra in
 *  nessuna decisione, perché è il pezzo che non deve viaggiare. */
export function tipoDaMime(mime: unknown): TipoMedia | null {
  const k = String(mime ?? "")
    .trim()
    .toLowerCase()
    .split(";")[0];
  return TIPI_AMMESSI[k]?.kind ?? null;
}

/** L'estensione da dare al file nello spazio pubblico. Vuota = tipo non
 *  ammesso, e allora non si carica affatto. */
export function estensioneDaMime(mime: unknown): string {
  const k = String(mime ?? "")
    .trim()
    .toLowerCase()
    .split(";")[0];
  return TIPI_AMMESSI[k]?.estensione ?? "";
}

/** ── IL CONTROLLO CHE FANNO TUTTI E DUE I LATI ────────────────────────────
 *  Lo chiama il browser prima di iniziare (per non far aspettare per niente) e
 *  lo richiama il server prima di consegnare il permesso di scrittura (perché
 *  il browser si può scavalcare). Una regola sola, in un posto solo: due
 *  controlli gemelli sono due controlli che un giorno dicono cose diverse.
 *  `motivo` è una frase da MOSTRARE, non un codice: chi la legge deve capire
 *  cosa fare senza chiamare nessuno.
 *  `causa` invece è per le macchine: serve al server a scegliere fra 415 (tipo
 *  sbagliato) e 413 (troppo pesante), che sono due rimedi diversi. ⚠️ Sta qui
 *  come campo e non si deduce leggendo la frase: un giorno la frase si riscrive
 *  per renderla più chiara e il codice di risposta cambierebbe insieme, senza
 *  che nessuno lo abbia chiesto. */
export function controllaFile(dati: {
  mime: unknown;
  peso: unknown;
}):
  | { ok: true; kind: TipoMedia; estensione: string }
  | { ok: false; causa: "tipo" | "peso"; motivo: string } {
  const mime = String(dati.mime ?? "")
    .trim()
    .toLowerCase()
    .split(";")[0];
  const kind = tipoDaMime(mime);
  if (!kind) return { ok: false, causa: "tipo", motivo: MOTIVO_TIPO(mime) };

  const peso = Number(dati.peso);
  //  Peso zero o illeggibile: non si rifiuta. Ci sono browser che non lo
  //  dichiarano, e bloccare qui vorrebbe dire rifiutare un file buono per un
  //  dato mancante. Il tetto del bucket resta comunque a fermare gli eccessi.
  if (!Number.isFinite(peso) || peso <= 0) {
    return { ok: true, kind, estensione: estensioneDaMime(mime) };
  }
  const tetto = kind === "video" ? LIMITE_VIDEO : LIMITE_FOTO;
  if (peso > tetto) {
    return {
      ok: false,
      causa: "peso",
      motivo:
        kind === "video"
          ? `Il video pesa ${mb(peso)} MB e il limite è ${mb(tetto)} MB: accorcialo o mandalo in qualità più bassa.`
          : `La foto pesa ${mb(peso)} MB e il limite è ${mb(tetto)} MB: di solito succede con le foto non compresse, riesportala in JPEG.`,
    };
  }
  return { ok: true, kind, estensione: estensioneDaMime(mime) };
}

/** La frase per un tipo rifiutato. HEIC ha la sua, perché è l'unico caso in cui
 *  la persona ha fatto tutto giusto ed è il telefono ad aver scelto un formato
 *  che qui non si vede (vedi TIPI_AMMESSI). */
function MOTIVO_TIPO(mime: string): string {
  if (/heic|heif/.test(mime)) {
    return "Il telefono ha salvato la foto in HEIC, che il browser non riesce a disegnare. Aprila nella galleria e condividila (o esportala) come JPEG.";
  }
  if (!mime) return "Non si capisce che tipo di file è: qui si caricano solo foto e video.";
  return `Qui si caricano solo foto e video: «${mime}» non è nessuno dei due.`;
}

/* ═══════════════════════════════════════════════════════════════════════════
   2. LEGGERE — quello che è salvato non è un tipo
   ═════════════════════════════════════════════════════════════════════════ */

/** Un indirizzo più lungo di così non è un indirizzo: è un media incollato
 *  dentro il dato (`data:image/jpeg;base64,…`), che farebbe pesare la scheda
 *  del lead qualche decina di mega. Stessa soglia e stessa ragione di
 *  media/galleria.ts, dove però la costante non è esportata. */
const MAX_URL = 2000;
const MAX_NOME = 120;

const testo = (x: unknown) => (typeof x === "string" ? x : "");

/** ── DA UNA VOCE GREZZA A UNA VOCE VERA ───────────────────────────────────
 *  ⚠️ `id` ripiega SULL'URL quando manca, e non su un valore sorteggiato al
 *   volo. Sembra un dettaglio ed è la differenza fra una principale che si
 *   salva e una che sparisce: un id inventato a ogni lettura cambia a ogni
 *   render, quindi `copertinaId` verrebbe scritto puntando a un id che la
 *   lettura successiva non produce più — e la principale si perderebbe in
 *   silenzio. L'url invece è stabile quanto il file. Le voci scritte da noi
 *   hanno sempre un id vero: questo ripiego serve solo a ciò che è stato
 *   importato o corretto a mano dal pannello Supabase. */
function normalizzaVoce(grezzo: unknown): MediaCliente | null {
  if (!grezzo || typeof grezzo !== "object" || Array.isArray(grezzo)) return null;
  const v = grezzo as Record<string, unknown>;
  const url = testo(v.url).trim();
  if (!url || url.length > MAX_URL) return null;
  const nome = testo(v.nome).trim().slice(0, MAX_NOME);
  return {
    id: testo(v.id).trim() || url,
    url,
    //  Come in normalizzaVoci: tutto ciò che non dice "image" è un video. Qui
    //  però il ripiego pesa di più — un'immagine scambiata per video non si
    //  potrebbe più scegliere come principale — quindi si accetta anche il caso
    //  in cui il tipo manca ma l'indirizzo finisce con un'estensione di foto.
    kind: v.kind === "image" || (v.kind === undefined && sembraFoto(url)) ? "image" : "video",
    ...(nome ? { nome } : {}),
    caricatoIl: testo(v.caricatoIl),
    ...(testo(v.caricatoDa).trim() ? { caricatoDa: testo(v.caricatoDa).trim() } : {}),
  };
}

const sembraFoto = (url: string) => /\.(jpe?g|png|webp|gif)(\?|#|$)/i.test(url);

/** ── IL PORTAFOGLIO, SEMPRE IN FORMA LEGGIBILE ────────────────────────────
 *  ⚠️ Non si dà per scontato che sia un oggetto: negli archivi importati un
 *   campo può arrivare come stringa, come null o come array, e un accesso
 *   diretto a `.voci` su un valore storto fa morire l'intera riga
 *   dell'elenco — cioè quattro schermate di installazioni.
 *  Le voci con lo stesso id si riducono alla prima: due id uguali renderebbero
 *  impossibile dire quale togliere e quale rendere principale. */
export function portafoglioDi(l: Lead | null | undefined): Required<MediaClienteInfo> {
  const v = l?.data?.mediaCliente as unknown;
  const ok = !!v && typeof v === "object" && !Array.isArray(v);
  const g = ok ? (v as Record<string, unknown>) : {};
  const grezze = Array.isArray(g.voci) ? g.voci : [];
  const viste = new Set<string>();
  const voci: MediaCliente[] = [];
  for (const x of grezze) {
    const voce = normalizzaVoce(x);
    if (!voce || viste.has(voce.id)) continue;
    viste.add(voce.id);
    voci.push(voce);
    if (voci.length >= MAX_VOCI) break;
  }
  return {
    voci,
    copertinaId: testo(g.copertinaId).trim(),
    aggiornatoIl: testo(g.aggiornatoIl),
  };
}

/** Le voci e basta, che è la domanda che fanno quasi tutti i lettori. */
export function vociMedia(l: Lead | null | undefined): MediaCliente[] {
  return portafoglioDi(l).voci;
}

/** C'è qualcosa da mostrare? È la domanda che decide se il pulsante sulla riga
 *  si disegna o no: le righe senza media sono la maggior parte, e un
 *  segnaposto su ognuna sarebbe rumore su quattro schermate. */
export function haMedia(l: Lead | null | undefined): boolean {
  return vociMedia(l).length > 0;
}

export function contaMedia(l: Lead | null | undefined): number {
  return vociMedia(l).length;
}

/** ── QUAL È LA PRINCIPALE ─────────────────────────────────────────────────
 *  Le tre regole in testa al file, in sette righe. Si CALCOLA a ogni lettura e
 *  non si scrive da nessuna parte, così riordinare l'elenco o togliere la foto
 *  scelta non lascia mai indietro un puntatore che non porta a niente.
 *  `null` = non c'è nessuna foto da mettere sul pulsante: portafoglio vuoto,
 *  oppure fatto di soli video (e allora chi disegna mostri un'icona, non un
 *  riquadro nero). */
export function principaleDi(l: Lead | null | undefined): MediaCliente | null {
  const { voci, copertinaId } = portafoglioDi(l);
  //  Scelta a mano: vale solo se quella voce c'è ancora ED è una foto. Il
  //  secondo controllo non è teorico — un archivio corretto a mano può
  //  contenere l'id di un video, e la regola 3 vale comunque.
  const scelta = copertinaId ? voci.find((v) => v.id === copertinaId) : undefined;
  if (scelta && scelta.kind === "image") return scelta;
  return voci.find((v) => v.kind === "image") ?? null;
}

/** L'indirizzo dell'anteprima, o stringa vuota. Comodo per chi disegna e non ha
 *  bisogno del resto della voce. */
export function urlPrincipale(l: Lead | null | undefined): string {
  return principaleDi(l)?.url ?? "";
}

/** Dove sta una voce nell'elenco: serve ad aprire il carosello ESATTAMENTE
 *  sulla foto su cui si è premuto, invece che sempre sulla prima. */
export function indiceDi(l: Lead | null | undefined, id: string): number {
  return vociMedia(l).findIndex((v) => v.id === id);
}

/** ── IL PONTE VERSO IL CAROSELLO ──────────────────────────────────────────
 *  Il carosello (media/Carosello.tsx) non sa niente del CRM: parla la lingua
 *  delle raccolte pubbliche, cioè VoceGalleria. La conversione passa da
 *  `normalizzaVoci`, la stessa che ripulisce le raccolte vere, così le due
 *  strade non possono divergere su cosa sia una voce valida.
 *
 *  ⚠️ QUI DENTRO VIAGGIA `nome`, CHE SPESSO È IL NOME DI UNA PERSONA. Va bene
 *   nella finestra del CRM, dove guarda solo chi lavora la pratica. Il giorno
 *   in cui da un portafoglio si vorrà creare un link /media/CODICE da mandare
 *   al cliente, i nomi vanno tolti PRIMA: quella pagina è pubblica e li
 *   mostrerebbe a chiunque abbia il link. */
export function vociGalleria(l: Lead | null | undefined): VoceGalleria[] {
  return normalizzaVoci(vociMedia(l));
}

/* ═══════════════════════════════════════════════════════════════════════════
   3. SCRIVERE — funzioni che restituiscono il portafoglio INTERO
   ═════════════════════════════════════════════════════════════════════════ */

/** ── PERCHÉ OGNI FUNZIONE RESTITUISCE TUTTO ───────────────────────────────
 *  `updateLead` fa un merge SUPERFICIALE: `{ ...current.data, ...patch }`.
 *  Passargli `{ mediaCliente: { copertinaId: "x" } }` non aggiunge una chiave,
 *  SOSTITUISCE l'oggetto — cioè cancella tutte le voci. Da qui esce sempre un
 *  `MediaClienteInfo` completo, pronto da scrivere così com'è.
 *
 *  ── E PERCHÉ RESTITUISCE ANCHE UN «MOTIVO» ───────────────────────────────
 *  Un rifiuto silenzioso è il guasto che questo repository ha già pagato più
 *  volte: la persona preme, non succede niente, e conclude che il pulsante è
 *  rotto. Quando `motivo` c'è, `info` è IDENTICO a quello di prima (non si
 *  scrive nulla) e chi chiama deve mostrare quella frase. */
export interface EsitoPortafoglio {
  /** Il portafoglio come va scritto. Se c'è `motivo`, è quello di prima. */
  info: MediaClienteInfo;
  /** La frase da mostrare quando non è cambiato niente. Assente = fatto. */
  motivo?: string;
}

function nuovoId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `med-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const adesso = () => new Date().toISOString();

/** Compone la voce da mettere in elenco DOPO che il file è già nello Storage.
 *  L'id nasce qui ed è la chiave stabile: non si ricava dall'url proprio perché
 *  l'url può cambiare (vedi il commento su MediaCliente). */
export function nuovaVoce(dati: {
  url: string;
  kind: TipoMedia;
  nome?: string;
  /** il consulente collegato col PIN, quando c'è. Serve a leggere, mai a
   *  decidere chi può togliere una voce. */
  caricatoDa?: string;
}): MediaCliente {
  const nome = String(dati.nome ?? "")
    .trim()
    .slice(0, MAX_NOME);
  const da = String(dati.caricatoDa ?? "").trim();
  return {
    id: nuovoId(),
    url: String(dati.url).trim(),
    kind: dati.kind === "image" ? "image" : "video",
    ...(nome ? { nome } : {}),
    caricatoIl: adesso(),
    ...(da ? { caricatoDa: da } : {}),
  };
}

/** ── AGGIUNGERE ───────────────────────────────────────────────────────────
 *  In coda, non in testa: l'ordine è quello in cui si è caricato, che è anche
 *  l'ordine in cui le cose sono successe (il prima, poi il dopo). Metterle in
 *  testa farebbe scorrere il carosello all'indietro nel tempo.
 *  La prima FOTO caricata su un portafoglio senza principale diventa la
 *  principale da sé — per calcolo, non per scrittura (vedi `principaleDi`):
 *  nessuno deve scegliere qualcosa quando c'è una sola risposta possibile. */
export function conVoceAggiunta(
  precedente: Required<MediaClienteInfo>,
  voce: MediaCliente,
): EsitoPortafoglio {
  if (precedente.voci.length >= MAX_VOCI) {
    return {
      info: precedente,
      motivo: `Il portafoglio è pieno: ${MAX_VOCI} fra foto e video sono il massimo. Togli qualcosa prima di aggiungere.`,
    };
  }
  if (!voce.url.trim()) {
    return {
      info: precedente,
      motivo: "Il file non ha un indirizzo: il caricamento non è andato a buon fine.",
    };
  }
  //  Stesso file due volte: capita premendo due volte, o riscegliendo lo stesso
  //  file dalla galleria. Non è un errore da urlare, ma un doppione nel
  //  carosello sì.
  if (precedente.voci.some((v) => v.url === voce.url)) {
    return { info: precedente, motivo: "Questo file è già nel portafoglio." };
  }
  return {
    info: { ...precedente, voci: [...precedente.voci, voce], aggiornatoIl: adesso() },
  };
}

/** ── TOGLIERE UNA VOCE, E POI CANCELLARE IL FILE ──────────────────────────
 *
 *  Questa funzione toglie una riga da un elenco dentro un JSON, e finisce qui:
 *  il file lo cancella chi chiama, subito dopo aver scritto la scheda, con
 *  `api.crm.media-elimina`. È il motivo per cui `tolta` esce da qui — ci sta
 *  dentro l'indirizzo del file, e chi cancella ce l'ha già in mano senza
 *  doverlo ripescare.
 *
 *  ⚠️ PER MESI QUESTA ERA UN'ELIMINAZIONE FINTA, e vale la pena ricordarlo:
 *   la voce spariva dalla scheda e il file restava nello spazio del centro, a
 *   un indirizzo pubblico che si apre senza credenziali, per sempre. Foto di
 *   teste, di prima e dopo, a volte di volti: un dato personale che
 *   sopravviveva alla propria cancellazione mentre chi premeva il pulsante
 *   credeva il contrario. Il messaggio a schermo lo diceva — ed era onesto —
 *   ma su un dato personale dire la verità su un difetto non è ripararlo.
 *
 *  ⚠️ RESTA APERTA LA META' PIÙ GRANDE DELLO STESSO PROBLEMA: il bucket è
 *   PUBBLICO (`public: true` in api.crm.media-upload), quindi anche una foto
 *   ancora in scheda è leggibile da chiunque conosca l'indirizzo. Chiuderlo
 *   non è una riga: gli indirizzi pubblici sono già scritti dentro le schede,
 *   e rendere privato il bucket li spegne tutti insieme — servono il percorso
 *   al posto dell'url e un indirizzo firmato a ogni lettura. È lavoro vero e
 *   va deciso sapendo che, mentre si migra, le foto già caricate non si
 *   vedono. */
export interface EsitoRimozione extends EsitoPortafoglio {
  /** La voce tolta dall'elenco: chi chiama la usa per cancellare il file.
   *  Assente = non c'era niente da togliere. */
  tolta?: MediaCliente;
}

export function senzaVoce(precedente: Required<MediaClienteInfo>, id: string): EsitoRimozione {
  const tolta = precedente.voci.find((v) => v.id === id);
  if (!tolta) {
    //  Non è un errore da mostrare: succede premendo due volte, o su una scheda
    //  ricaricata da un altro. Non si scrive niente e non si dice niente.
    return { info: precedente };
  }
  const voci = precedente.voci.filter((v) => v.id !== id);
  //  Si spegne anche il puntatore alla principale, se era lei: `principaleDi`
  //  saprebbe comunque ripiegare sulla prima foto, ma lasciare scritto l'id di
  //  qualcosa che non c'è più significa portarsi dietro un dato che mente, e un
  //  domani qualcuno lo leggerà senza passare da qui.
  const copertinaId = precedente.copertinaId === id ? "" : precedente.copertinaId;
  return { info: { ...precedente, voci, copertinaId, aggiornatoIl: adesso() }, tolta };
}

/** ── SCEGLIERE LA PRINCIPALE ──────────────────────────────────────────────
 *  Non serve spegnere niente: il campo è uno solo, quindi la precedente si
 *  spegne da sé (regola 1 in testa al file).
 *  ⚠️ Un video viene rifiutato con la sua frase — non ignorato — perché chi lo
 *   ha appena scelto sta guardando il pulsante e aspetta che cambi. */
export function conPrincipale(
  precedente: Required<MediaClienteInfo>,
  id: string,
): EsitoPortafoglio {
  const voce = precedente.voci.find((v) => v.id === id);
  if (!voce) {
    return {
      info: precedente,
      motivo: "Questa foto non è più nel portafoglio: ricarica la scheda.",
    };
  }
  if (voce.kind !== "image") {
    return {
      info: precedente,
      motivo:
        "Sul pulsante ci va una foto: di un video potremmo mostrare solo il primo fotogramma, che quasi sempre è nero.",
    };
  }
  //  Sceglierla di nuovo non è una modifica: scriverla comunque significherebbe
  //  una riga in più nello storico della scheda per un gesto che non ha
  //  cambiato niente.
  if (precedente.copertinaId === id) return { info: precedente };
  return { info: { ...precedente, copertinaId: id, aggiornatoIl: adesso() } };
}

/** Toglie la scelta a mano e rimette il ripiego: la prima foto dell'elenco.
 *  Non cancella niente, sposta solo il pulsante. */
export function senzaPrincipale(precedente: Required<MediaClienteInfo>): EsitoPortafoglio {
  if (!precedente.copertinaId) return { info: precedente };
  return { info: { ...precedente, copertinaId: "", aggiornatoIl: adesso() } };
}

/** ── RIORDINARE ───────────────────────────────────────────────────────────
 *  `ordine` è l'elenco degli id nella sequenza voluta. Le voci che non compaiono
 *  restano IN CODA nell'ordine che avevano: un elenco parziale — arrivato da
 *  un'interfaccia che ne conosceva solo una parte, o da una scheda aperta prima
 *  che qualcuno aggiungesse una foto — non deve far sparire niente. È la stessa
 *  cautela per cui `scrivi` in crm/spedizione.ts riparte sempre da ciò che c'è. */
export function conOrdine(
  precedente: Required<MediaClienteInfo>,
  ordine: string[],
): EsitoPortafoglio {
  const perId = new Map(precedente.voci.map((v) => [v.id, v]));
  const messe = new Set<string>();
  const voci: MediaCliente[] = [];
  for (const id of Array.isArray(ordine) ? ordine : []) {
    const v = perId.get(id);
    if (!v || messe.has(id)) continue;
    messe.add(id);
    voci.push(v);
  }
  for (const v of precedente.voci) if (!messe.has(v.id)) voci.push(v);
  if (voci.every((v, i) => v.id === precedente.voci[i]?.id)) return { info: precedente };
  return { info: { ...precedente, voci, aggiornatoIl: adesso() } };
}

/** ── RINOMINARE ───────────────────────────────────────────────────────────
 *  ⚠️ È un APPUNTO INTERNO e non deve mai finire sotto gli occhi del cliente
 *   (vedi `vociGalleria`). Svuotarlo è legittimo: la voce torna senza nome e in
 *   elenco si legge la data di caricamento. */
export function conNome(
  precedente: Required<MediaClienteInfo>,
  id: string,
  nome: string,
): EsitoPortafoglio {
  const pulito = String(nome ?? "")
    .trim()
    .slice(0, MAX_NOME);
  const voce = precedente.voci.find((v) => v.id === id);
  if (!voce) return { info: precedente };
  if ((voce.nome ?? "") === pulito) return { info: precedente };
  const voci = precedente.voci.map((v) =>
    v.id === id
      ? ({ ...v, ...(pulito ? { nome: pulito } : { nome: undefined }) } as MediaCliente)
      : v,
  );
  return { info: { ...precedente, voci, aggiornatoIl: adesso() } };
}
