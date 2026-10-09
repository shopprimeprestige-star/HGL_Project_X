/** ── LEGGERE I DATI DA UNA FOTOGRAFIA DEL DOCUMENTO ────────────────────────
 *
 *  Il codice fiscale battuto a mano dal telefono è il campo che si sbaglia più
 *  spesso di tutto il gestionale: sedici caratteri senza senso, letti da una
 *  fotografia storta, ricopiati mentre si è al telefono. Una fattura con un
 *  codice fiscale sbagliato viene scartata dallo SDI, e lo si scopre giorni
 *  dopo — quando quella persona non risponde più al telefono.
 *
 *  Qui la fotografia della tessera sanitaria (o della carta d'identità) si
 *  legge una volta e i campi si riempiono da soli.
 *
 *  ── ⚠️ QUESTO MODULO NON PARLA CON NESSUNO ───────────────────────────────
 *  Prompt, pulizia e innesto dei dati stanno qui, senza rete e senza React: è
 *  la parte che decide cosa finisce in una fattura vera, ed è quella che vale
 *  la pena poter provare senza aprire il programma né spendere una chiamata.
 *  La chiamata al modello sta in routes/api.crm.documento.
 */

/** Quello che si riesce a leggere da un documento italiano. Tutti facoltativi:
 *  una tessera sanitaria non ha l'indirizzo, una carta d'identità non ha il
 *  codice fiscale in chiaro su entrambe le facce, e una fotografia mossa può
 *  non avere niente. */
export interface DatiDocumento {
  nome?: string;
  cognome?: string;
  codiceFiscale?: string;
  indirizzo?: string;
  cap?: string;
  comune?: string;
  provincia?: string;
  /** Che documenti ha riconosciuto: serve a dirlo a chi guarda («letto dalla
   *  tessera sanitaria»), che è il modo più rapido per accorgersi di aver
   *  caricato il file sbagliato. */
  documenti?: string[];
}

/** ⚠️ IL TESTO CHIEDE SOLO QUELLO CHE SERVE ALLA FATTURA, e dice di NON
 *  inventare. Un modello a cui si chiede «tutti i dati» restituisce anche la
 *  data di nascita, il numero del documento e la scadenza — roba che non serve
 *  a fatturare e che, una volta arrivata, qualcuno prima o poi salverebbe da
 *  qualche parte. Meno campi si chiedono, meno dati personali girano.
 *  ⚠️ E si chiede JSON PURO: un modello che risponde «Ecco i dati:» seguito da
 *   un elenco costringe a indovinare, e indovinare su un codice fiscale vuol
 *   dire una fattura scartata. */
export const PROMPT_DOCUMENTO =
  "The attached files are Italian identity documents of ONE person: health card "
  + "(«tessera sanitaria»), identity card («carta d'identità»), driving licence («patente») or "
  + "passport («passaporto»). "
  + "There may be SEVERAL files — front and back of the same card, or different documents of the "
  + "same person — and each may be a photo or a PDF scan, portrait or landscape, ROTATED by 90, "
  + "180 or 270 degrees or slightly skewed. Read them all, in whatever orientation they are, and "
  + "MERGE what you find into one single answer: a field read on any file is good. "
  + "Work out by yourself which document each file is — nobody will tell you. "
  + "Read ONLY these fields and return STRICT JSON, no prose, no markdown fence:\n"
  + '{"nome":"","cognome":"","codiceFiscale":"","indirizzo":"","cap":"","comune":"","provincia":"",'
  + '"documenti":[]}\n'
  + "Rules: use \"\" for anything you cannot read with certainty — never guess, never invent. "
  + "codiceFiscale is the 16-character Italian tax code, uppercase, no spaces. "
  + "indirizzo is street and house number only. cap is the 5-digit postal code. "
  + "provincia is the 2-letter province code, uppercase. "
  + 'documenti lists what you recognised, using only these words: "tessera sanitaria", '
  + '"carta d\'identità", "patente", "passaporto", "altro". '
  + "Do not return dates of birth, document numbers or expiry dates.";

/** ── COSA SI PUÒ CARICARE ──────────────────────────────────────────────────
 *  Una fotografia o un PDF, ed è la differenza fra «funziona» e «funziona per
 *  come arrivano i documenti davvero»: la tessera fotografata col telefono
 *  arriva come immagine, quella mandata dal commercialista o scaricata dallo
 *  SPID arriva come PDF. Chiedere di convertirla vuol dire non usare il tasto.
 *
 *  ⚠️ I limiti stanno QUI e non nella finestra: la porta li ricontrolla, e due
 *   idee diverse di «troppo pesante» fanno passare dalla finestra un file che
 *   il server rifiuta — con un errore che arriva dopo trenta secondi di attesa.
 */
export const PESO_MASSIMO_DOCUMENTO = 8 * 1024 * 1024;

export function documentoAccettabile(dataUrl: string): {
  ok: boolean;
  perche?: string;
  tipo?: "immagine" | "pdf";
} {
  const s = String(dataUrl || "");
  const m = /^data:(image\/(?:jpeg|jpg|png|webp|heic|heif)|application\/pdf);base64,([A-Za-z0-9+/=]+)$/.exec(s);
  if (!m) {
    return { ok: false, perche: "Carica una foto (JPG, PNG) oppure un PDF del documento." };
  }
  //  base64 pesa un terzo in più dei byte veri.
  const byte = Math.floor((m[2].length * 3) / 4);
  //  ⚠️ Il minimo è basso apposta: un PDF di solo testo — una tessera
  //   scaricata, non fotografata — pesa pochi kilobyte ed è perfettamente
  //   leggibile. Il minimo serve solo a fermare i file vuoti.
  if (byte < 2 * 1024) return { ok: false, perche: "Il file sembra vuoto: riprova." };
  if (byte > PESO_MASSIMO_DOCUMENTO) {
    return { ok: false, perche: "Il file è troppo pesante: riprova con una foto più piccola." };
  }
  return { ok: true, tipo: m[1] === "application/pdf" ? "pdf" : "immagine" };
}

const pulisci = (v: unknown): string => String(v ?? "").replace(/\s+/g, " ").trim();

/** Il maiuscolo all'italiana per nomi e comuni: «MARIO ROSSI» sulla tessera,
 *  «Mario Rossi» in fattura. ⚠️ Si tengono i pezzi separati — «de Luca»,
 *  «Sant'Elia» — perché un cognome tutto maiuscolo su un documento fiscale
 *  sembra un errore di chi l'ha scritto. */
export function comeUnNome(s: string): string {
  return pulisci(s)
    .toLowerCase()
    .replace(/(^|[\s'-])([a-zà-ù])/g, (_, p: string, c: string) => p + c.toUpperCase());
}

/** ── IL CODICE FISCALE SI CONTROLLA, NON SI CREDE ──────────────────────────
 *  Una lettura sbagliata di un solo carattere passa inosservata a occhio — «0»
 *  e «O», «1» e «I» — e la fattura viene scartata giorni dopo. Il carattere di
 *  controllo esiste apposta: se non torna, il codice non entra in un documento
 *  fiscale, e chi fattura lo scrive a mano guardando la tessera.
 */
const PARI: Record<string, number> = {};
const DISPARI: Record<string, number> = {};
{
  const alfabeto = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const valoriDispari = [
    1, 0, 5, 7, 9, 13, 15, 17, 19, 21, 1, 0, 5, 7, 9, 13, 15, 17, 19, 21, 2, 4, 18, 20, 11, 3, 6, 8,
    12, 14, 16, 10, 22, 25, 24, 23,
  ];
  alfabeto.split("").forEach((c, i) => {
    PARI[c] = i < 10 ? i : i - 10;
    DISPARI[c] = valoriDispari[i];
  });
}

export function codiceFiscaleValido(cf: string): boolean {
  const s = pulisci(cf).toUpperCase().replace(/\s/g, "");
  if (!/^[A-Z0-9]{16}$/.test(s)) return false;
  let somma = 0;
  for (let i = 0; i < 15; i += 1) {
    const c = s[i];
    //  Le posizioni si contano da 1: la prima è dispari.
    somma += (i % 2 === 0 ? DISPARI : PARI)[c] ?? 0;
  }
  return "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[somma % 26] === s[15];
}

/** Il JSON del modello, letto con prudenza: può arrivare dentro un recinto
 *  ```json, con del testo attorno, o non arrivare affatto. */
export function leggiJsonDocumento(testo: string): DatiDocumento {
  const grezzo = String(testo ?? "");
  const senzaRecinto = grezzo.replace(/```(?:json)?/gi, " ");
  const inizio = senzaRecinto.indexOf("{");
  const fine = senzaRecinto.lastIndexOf("}");
  if (inizio < 0 || fine <= inizio) return {};
  try {
    const o = JSON.parse(senzaRecinto.slice(inizio, fine + 1)) as Record<string, unknown>;
    return normalizzaDocumento(o);
  } catch {
    return {};
  }
}

/** I campi ripuliti, nella forma in cui vanno in fattura. Quello che non
 *  supera il controllo NON viene restituito: un dato storto in un campo vuoto
 *  è peggio del campo vuoto, perché nessuno lo va più a guardare. */
export function normalizzaDocumento(o: Record<string, unknown>): DatiDocumento {
  const d: DatiDocumento = {};
  const nome = comeUnNome(pulisci(o.nome));
  const cognome = comeUnNome(pulisci(o.cognome));
  if (nome) d.nome = nome;
  if (cognome) d.cognome = cognome;

  const cf = pulisci(o.codiceFiscale).toUpperCase().replace(/\s/g, "");
  if (codiceFiscaleValido(cf)) d.codiceFiscale = cf;

  const indirizzo = pulisci(o.indirizzo);
  if (indirizzo) d.indirizzo = comeUnNome(indirizzo).replace(/\bVia\b/i, "Via");

  //  ⚠️ Il CAP è di CINQUE cifre: «7010» è una lettura mancata, non un CAP
  //   corto, e messo in fattura fa scartare il file.
  const cap = pulisci(o.cap).replace(/\D/g, "");
  if (/^\d{5}$/.test(cap)) d.cap = cap;

  const comune = comeUnNome(pulisci(o.comune));
  if (comune) d.comune = comune;

  const provincia = pulisci(o.provincia).toUpperCase().replace(/[^A-Z]/g, "");
  if (/^[A-Z]{2}$/.test(provincia)) d.provincia = provincia;

  //  ⚠️ Solo i nomi che conosciamo: quello che arriva è testo di un modello, e
  //   finisce a schermo. Un documento inventato («carta regionale dei
  //   servizi») non fa danni, ma «altro» dice la stessa cosa senza far pensare
  //   che il programma sappia qualcosa che non sa.
  const noti = ["tessera sanitaria", "carta d'identità", "patente", "passaporto"];
  const grezzi = Array.isArray(o.documenti) ? o.documenti : [];
  const documenti = Array.from(
    new Set(
      grezzi
        .map((x) => pulisci(x).toLowerCase().replace(/[''`]/g, "'"))
        .map((x) => noti.find((n) => x.includes(n.replace(/'/g, "'"))) || (x ? "altro" : ""))
        .filter(Boolean),
    ),
  );
  if (documenti.length) d.documenti = documenti;

  return d;
}

export interface EsitoInnesto<T> {
  dati: T;
  /** i campi riempiti adesso, con il nome che si legge a schermo */
  riempiti: string[];
  /** quelli letti ma lasciati stare perché c'era già qualcosa scritto */
  giaPresenti: string[];
}

/** ⚠️ Solo i campi che si INNESTANO nella fattura: `documenti` dice cosa è
 *  stato riconosciuto e si mostra a schermo, ma non è un campo del cliente —
 *  metterlo qui vorrebbe dire provare a scriverlo dentro l'intestazione. */
const ETICHETTE: Record<Exclude<keyof DatiDocumento, "documenti">, string> = {
  nome: "nome",
  cognome: "cognome",
  codiceFiscale: "codice fiscale",
  indirizzo: "indirizzo",
  cap: "CAP",
  comune: "comune",
  provincia: "provincia",
};

/** ── SI RIEMPIE SOLO QUELLO CHE È VUOTO ────────────────────────────────────
 *  ⚠️ Non si sovrascrive MAI un campo già compilato, nemmeno se la fotografia
 *   dice un'altra cosa. Chi ha scritto quel dato può averlo corretto apposta —
 *   un cliente che ha cambiato casa, un nome d'arte, una ragione sociale — e
 *   vedersi riscrivere sopra da una fotografia è il modo più veloce per
 *   smettere di fidarsi del pulsante. Quello che non entra si dice, così chi
 *   guarda può decidere da sé.
 */
export function innestaDocumento<T extends DatiDocumento>(
  attuali: T,
  letti: DatiDocumento,
): EsitoInnesto<T> {
  const dati = { ...attuali };
  const riempiti: string[] = [];
  const giaPresenti: string[] = [];
  (Object.keys(ETICHETTE) as Exclude<keyof DatiDocumento, "documenti">[]).forEach((k) => {
    const nuovo = pulisci(letti[k]);
    if (!nuovo) return;
    if (pulisci(attuali[k])) {
      //  Uguale a quello che c'è già non è «occupato»: è una conferma, e
      //  dirlo sarebbe rumore.
      if (pulisci(attuali[k]).toLowerCase() !== nuovo.toLowerCase()) giaPresenti.push(ETICHETTE[k]);
      return;
    }
    (dati as Record<string, unknown>)[k] = nuovo;
    riempiti.push(ETICHETTE[k]);
  });
  return { dati, riempiti, giaPresenti };
}
