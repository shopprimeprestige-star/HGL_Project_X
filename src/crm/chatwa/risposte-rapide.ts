/** ── LA CHAT WHATSAPP · LE RISPOSTE RAPIDE ──────────────────────────────────
 *
 *  Richiesta del titolare (28/10/2026), commessa chat-risposte-rapide:
 *   1. scrivendo «/» nella casella si apre l'elenco delle risposte rapide;
 *      «/2» o «/parola» filtra; Invio o un tocco mette il testo nella casella
 *      (non invia), come le risposte rapide di WhatsApp Business;
 *   2. senza «/», sopra la casella una fila di suggerimenti ordinati per
 *      pertinenza: l'ultimo messaggio del cliente e lo stato del lead;
 *   3. testi modificabili (matita), salvati in `app_config`
 *      «wa_risposte_rapide» e condivisi dallo studio, come «wa_stelle».
 *  Qui le regole, PURE (niente React né Supabase): prove in
 *  prove/manychat/chat-risposte.mjs. Le usano `useRisposteRapide` e la casella.
 *
 *  ⚠️ I TEMI E GLI STATI DI UNA RISPOSTA NON SI SALVANO: vengono dal codice,
 *   per id. Chi corregge il testo di una predefinita le lascia la pertinenza;
 *   una risposta aggiunta dallo studio non ne ha e sta dopo quelle pertinenti.
 *  ⚠️ IL MESSAGGIO DEL CLIENTE È TESTO ESTERNO: si taglia a 500 caratteri e le
 *   regex sono parole in alternativa, senza quantificatori annidati (ReDoS).
 *  ⚠️ SI DÀ DEL LEI, come i primi messaggi (manychat/testi.ts, whatsapp.ts),
 *   e non si firma (whatsapp.ts, MODELLI_ORIGINALI: la chat ha già il nome in
 *   cima). Niente prezzi né indirizzi inventati: il prezzo si dà dopo la
 *   consulenza, l'indirizzo è il segnaposto {indirizzo} che la casella segnala
 *   finché l'operatore non lo scrive. Niente promesse mediche.
 *  ───────────────────────────────────────────────────────────────────────── */
import { classificaTesto } from "./media";

export const CHIAVE_CONFIG_RISPOSTE = "wa_risposte_rapide";

/** Di cosa parla il messaggio del cliente. */
export type Tema =
  | "saluto"
  | "info"
  | "prezzo"
  | "dove"
  | "prenota"
  | "collegamento"
  | "conferma"
  | "sposta"
  | "foto"
  | "acconto"
  | "installazione"
  | "domicilio"
  | "manutenzione"
  | "chirurgia"
  | "ci_penso"
  | "rifiuto"
  | "grazie";

export interface RispostaRapida {
  id: string;
  titolo: string;
  testo: string;
  /** Solo le predefinite: i temi del cliente a cui rispondono. */
  temi?: Tema[];
  /** Solo le predefinite: gli stati del lead in cui servono. */
  stati?: string[];
}

const APPUNTAMENTO = ["appuntamento_fissato", "appuntamento_rifissato"];
const DA_FISSARE = [
  "da_contattare",
  "attesa_whatsapp",
  "da_chiamare",
  "richiamo",
  "fissa_meet_dopo",
  "gestire_in_chat",
];
const SALTATA = ["no_show", "non_fatto", "da_spostare"];
const DOPO_CONSULENZA = ["sta_valutando", "da_ricontattare", "ripensamento", "ci_ricontatta_lui"];
const POSA = ["posa_in_sede", "posa_a_domicilio", "posa_da_spedire"];

/** Le risposte di partenza. L'ordine è quello dei numeri di «/1», «/2»… */
export const RISPOSTE_PREDEFINITE: readonly RispostaRapida[] = [
  {
    id: "presentazione",
    titolo: "Presentazione",
    testo:
      "Buongiorno {nome}, la contatto da Hair Genius Labs per la richiesta di informazioni che ci ha lasciato.\n\nCi occupiamo di soluzioni non chirurgiche per la perdita dei capelli. Possiamo fissare una prima consulenza gratuita online, in videochiamata: preferisce la mattina o il pomeriggio?",
    temi: ["saluto"],
    stati: ["da_contattare"],
  },
  {
    id: "come_funziona",
    titolo: "Come funziona",
    testo:
      "Ci occupiamo di sistemi capillari su misura, non chirurgici: la patch cutanea e Invisible Derm.\n\nNella consulenza gratuita in videochiamata vediamo la sua situazione e quale soluzione è più adatta. Quando le farebbe comodo?",
    temi: ["info"],
  },
  {
    id: "consulenza_gratuita",
    titolo: "Consulenza gratuita",
    testo:
      "La prima consulenza è gratuita e senza impegno: si fa online, in videochiamata, dal telefono o dal computer, senza installare nulla.\n\nLe va bene fissarla?",
    temi: ["info", "prenota"],
    stati: DA_FISSARE,
  },
  {
    id: "chiedi_disponibilita",
    titolo: "Chiedi disponibilità",
    testo:
      "Quali giorni e orari le vanno meglio per la consulenza gratuita online? Controllo l'agenda e le confermo subito.",
    temi: ["prenota"],
    stati: DA_FISSARE,
  },
  {
    id: "mattina_pomeriggio",
    titolo: "Mattina o pomeriggio?",
    testo: "Preferisce la mattina o il pomeriggio?",
    temi: ["prenota"],
  },
  {
    id: "conferma_meet",
    titolo: "Conferma consulenza",
    testo:
      "Perfetto {nome}, la consulenza è confermata. La seguirà {consulente|uno dei nostri consulenti}: le mando qui il link, lo apre dal telefono o dal computer senza installare nulla.",
    temi: ["conferma"],
    stati: [...APPUNTAMENTO, "attesa_whatsapp"],
  },
  {
    id: "link_meet",
    titolo: "Link della consulenza",
    testo:
      "Ecco il link per la consulenza: {link}\n\nBasta aprirlo all'orario fissato, dal telefono o dal computer.",
    temi: ["collegamento"],
    stati: APPUNTAMENTO,
  },
  {
    id: "promemoria",
    titolo: "Promemoria consulenza",
    testo:
      "Buongiorno {nome}, le ricordo la consulenza di oggi. Riesce a collegarsi all'orario fissato?",
    stati: APPUNTAMENTO,
  },
  {
    id: "sposta",
    titolo: "Spostare la consulenza",
    testo:
      "Nessun problema {nome}, la spostiamo volentieri. Quale giorno e orario le andrebbero meglio?",
    temi: ["sposta"],
    stati: SALTATA,
  },
  {
    id: "consulenza_saltata",
    titolo: "Consulenza saltata",
    testo:
      "Buongiorno {nome}, oggi non siamo riusciti a collegarci per la consulenza. Vuole che la rifissiamo? Mi indichi il giorno e l'orario che preferisce.",
    stati: SALTATA,
  },
  {
    id: "prezzo",
    titolo: "Info prezzi",
    testo:
      "Il costo dipende dalla soluzione più adatta alla sua situazione: per questo glielo indichiamo con precisione durante la consulenza gratuita, senza impegno. Fissiamo un orario?",
    temi: ["prezzo"],
  },
  {
    id: "riepilogo",
    titolo: "Riepilogo dopo consulenza",
    testo:
      "Grazie ancora per la consulenza, {nome}. Come d'accordo le riepilogo qui la soluzione e il prezzo di cui abbiamo parlato; per qualsiasi domanda mi scriva pure.",
    temi: ["prezzo"],
    stati: DOPO_CONSULENZA,
  },
  {
    id: "dove",
    titolo: "Dove siete",
    testo:
      "La prima consulenza si fa online, in videochiamata, quindi può farla comodamente da casa. Per l'installazione può venire nella nostra sede oppure possiamo venire noi a domicilio.",
    temi: ["dove", "domicilio"],
  },
  {
    id: "sede",
    titolo: "Indirizzo della sede",
    testo:
      "La nostra sede è in {indirizzo}. Le mando qui la posizione quando fissiamo l'appuntamento.",
    temi: ["dove"],
    stati: ["viene_in_sede", "posa_in_sede"],
  },
  {
    id: "domicilio",
    titolo: "Installazione a domicilio",
    testo:
      "Sì, l'installazione si può fare anche a domicilio. Ne parliamo in consulenza e troviamo insieme la soluzione più comoda per lei.",
    temi: ["domicilio"],
    stati: ["posa_a_domicilio"],
  },
  {
    id: "installazione",
    titolo: "Fissare l'installazione",
    testo:
      "Buongiorno {nome}, possiamo fissare l'installazione. Preferisce venire in sede o che veniamo noi a domicilio? Mi indichi qualche giorno che le va bene.",
    temi: ["installazione"],
    stati: [...POSA, "acconto"],
  },
  {
    id: "acconto",
    titolo: "Acconto",
    testo:
      "Per confermare l'ordine del suo sistema serve l'acconto concordato. Le mando qui i dati per il pagamento.",
    temi: ["acconto"],
    stati: ["in_attesa_acconto"],
  },
  {
    id: "acconto_ricevuto",
    titolo: "Acconto ricevuto",
    testo:
      "Grazie {nome}, abbiamo ricevuto l'acconto: l'ordine è confermato. La ricontattiamo noi per fissare l'installazione.",
    temi: ["acconto"],
    stati: ["acconto"],
  },
  {
    id: "manutenzione",
    titolo: "Manutenzione",
    testo:
      "Tutte le indicazioni per la manutenzione gliele diamo all'installazione, e per i controlli può fissare un appuntamento con noi quando vuole. Ha una domanda in particolare?",
    temi: ["manutenzione"],
    stati: [...POSA, "concluso"],
  },
  {
    id: "foto_ricevute",
    titolo: "Foto ricevute",
    testo:
      "Grazie {nome}, ho ricevuto le foto. Le guardiamo insieme nella consulenza gratuita in videochiamata: quando le farebbe comodo?",
    temi: ["foto"],
  },
  {
    id: "chiedi_foto",
    titolo: "Chiedi le foto",
    testo:
      "Se le va, mi mandi qui una foto della testa dall'alto e una di lato: ci aiutano a preparare la consulenza.",
    stati: APPUNTAMENTO,
  },
  {
    id: "non_chirurgico",
    titolo: "Non è chirurgico",
    testo:
      "Non si tratta di un trapianto né di un intervento chirurgico: è un sistema capillare su misura che si applica senza operazioni. In consulenza le spieghiamo tutto nel dettaglio.",
    temi: ["chirurgia"],
  },
  {
    id: "non_risponde",
    titolo: "Non riesco a contattarla",
    testo:
      "Buongiorno {nome}, ho provato a chiamarla senza trovarla. Quando posso richiamarla? Mi scriva pure qui un orario comodo.",
    stati: ["non_risponde", "segreteria", "irreperibile", "richiamo"],
  },
  {
    id: "ci_pensa",
    titolo: "Ci vuole pensare",
    testo:
      "Certo {nome}, si prenda il tempo che le serve. La ricontatto io fra qualche giorno; se intanto ha domande, mi scriva qui.",
    temi: ["ci_penso"],
    stati: DOPO_CONSULENZA,
  },
  {
    id: "ultimo_tentativo",
    titolo: "Ultimo messaggio",
    testo:
      "Buongiorno {nome}, non avendo avuto risposta non la disturbo oltre. Se in futuro vorrà fissare la consulenza gratuita, mi scriva pure qui.",
    stati: ["irreperibile"],
  },
  {
    id: "non_interessato",
    titolo: "Non interessato",
    testo: "Capito {nome}, nessun problema. Se più avanti vorrà riparlarne, ci scriva pure qui.",
    temi: ["rifiuto"],
    stati: ["annullato", "perdi_tempo"],
  },
  {
    id: "grazie",
    titolo: "Grazie",
    testo: "Grazie a lei {nome}! Per qualsiasi cosa ci scriva pure qui.",
    temi: ["grazie"],
  },
  {
    id: "verifico",
    titolo: "Verifico e le dico",
    testo: "Grazie, verifico e le rispondo a breve.",
  },
];

/* ── IL COMANDO «/» ─────────────────────────────────────────────────────── */

/** Minuscole, senza accenti, apostrofi dritti: «Dovè» e «dove» si trovano uguali. */
function normale(t: string): string {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’‘`]/g, "'").toLowerCase();
}

const MAX_COMANDO = 40;

/** La ricerca dopo «/» (minuscola, senza spazi ai lati), o `null` se la casella
 *  non è un comando: deve cominciare con «/», stare su una riga, essere corta. */
export function comandoDi(bozza: string): string | null {
  const t = bozza.trimStart();
  if (!t.startsWith("/") || t.includes("\n") || t.length > MAX_COMANDO + 1) return null;
  return t.slice(1).trim().toLowerCase();
}

export interface RispostaNumerata {
  risposta: RispostaRapida;
  /** Il numero di «/n»: la posizione nell'elenco salvato, da 1. */
  numero: number;
}

/** Le risposte che corrispondono alla ricerca.
 *  - vuota: tutte, nell'ordine salvato;
 *  - solo cifre: il numero esatto, poi quelli che cominciano con quelle cifre;
 *  - parole: servono tutte (inizio di una parola del titolo o del testo); sopra
 *    il titolo che comincia con la ricerca, poi il titolo, poi il testo. */
export function filtraRisposte(
  elenco: readonly RispostaRapida[],
  ricerca: string,
): RispostaNumerata[] {
  const tutte = elenco.map((risposta, i) => ({ risposta, numero: i + 1 }));
  const q = normale(ricerca).trim();
  if (!q) return tutte;
  if (/^\d+$/.test(q)) {
    return tutte
      .filter((x) => String(x.numero).startsWith(q))
      .sort(
        (a, b) =>
          Number(String(b.numero) === q) - Number(String(a.numero) === q) || a.numero - b.numero,
      );
  }
  const parole = q.split(/\s+/);
  const punti = (x: RispostaNumerata): number => {
    const titolo = normale(x.risposta.titolo);
    const paroleTitolo = titolo.split(/[^a-z0-9']+/);
    const paroleTesto = normale(x.risposta.testo).split(/[^a-z0-9']+/);
    const nelTitolo = (p: string) => paroleTitolo.some((w) => w.startsWith(p));
    const nelTesto = (p: string) => paroleTesto.some((w) => w.startsWith(p));
    if (!parole.every((p) => nelTitolo(p) || nelTesto(p))) return 0;
    if (titolo.startsWith(q)) return 3;
    return parole.some(nelTitolo) ? 2 : 1;
  };
  return tutte
    .map((x) => ({ x, p: punti(x) }))
    .filter((y) => y.p > 0)
    .sort((a, b) => b.p - a.p || a.x.numero - b.x.numero)
    .map((y) => y.x);
}

/* ── I SUGGERIMENTI ─────────────────────────────────────────────────────── */

/** Parole che dicono il tema. Ogni regex: parole in alternativa, al più un
 *  `\w*` in coda, nessun quantificatore dentro un altro (testo del cliente). */
const PAROLE: [Tema, RegExp][] = [
  ["saluto", /\b(?:buongiorno|buonasera|ciao|salve)\b/],
  [
    "info",
    /\b(?:info|informazion\w*|come funziona|di cosa si tratta|cos'e|protesi|sistem[ai] capillar\w*|patch|invisible|parrucc\w*)\b/,
  ],
  [
    "prezzo",
    /\b(?:prezz\w*|cost[aoi]|costano|quanto (?:viene|verrebbe|si spende|pago)|euro|listino|preventiv\w*|spesa)\b|€/,
  ],
  ["dove", /\b(?:dove|sede|indirizzo|in che citta|che zona|vi trovate|siete a)\b/],
  [
    "prenota",
    /\b(?:appuntament\w*|prenot\w*|disponibil\w*|quando|orari\w*|fissare|domani|stasera|mattina|pomeriggio|lunedi|martedi|mercoledi|giovedi|venerdi|sabato)\b/,
  ],
  ["collegamento", /\b(?:link|collegar\w*|collego|accedere|entrare|meet)\b/],
  [
    "sposta",
    /\b(?:spost\w*|rimand\w*|rinvi\w*|non riesco|non posso|imprevist\w*|un altro giorno|riprogramm\w*|disdir\w*|annullar\w*|cambiare (?:giorno|orario|data))\b/,
  ],
  ["foto", /\b(?:foto|fotografi\w*|immagin\w*|allego|in allegato)\b/],
  ["acconto", /\b(?:acconto|caparra|bonifico|iban|pagament\w*|pagare|rate|rateizz\w*|anticipo)\b/],
  ["installazione", /\b(?:installazion\w*|installar\w*|applicazion\w*|applicar\w*|posa)\b/],
  ["domicilio", /\b(?:domicilio|a casa|casa mia|venite voi|venire voi|potete venire)\b/],
  [
    "manutenzione",
    /\b(?:manutenzion\w*|pulizi\w*|quanto dura|durata|si stacca|stacc\w*|lavar\w*|doccia|piscina|mare|palestra|sudo\w*|ogni quanto)\b/,
  ],
  [
    "chirurgia",
    /\b(?:trapiant\w*|chirurg\w*|intervento|operazione|anestesi\w*|fa male|dolor\w*)\b/,
  ],
  [
    "ci_penso",
    /\b(?:ci penso|ci devo pensare|pensarci|devo pensare|valutar\w*|non sono sicur\w*|piu avanti|non ora|non adesso|ne parlo con)\b/,
  ],
  [
    "rifiuto",
    /\b(?:non mi interessa|non sono interessat\w*|no grazie|non piu interessat\w*|lasciate perdere)\b/,
  ],
  ["grazie", /\b(?:grazie|gentilissim\w*|ringrazio)\b/],
];

/** «Sì», «ok perfetto», «va bene domani»: una conferma è un messaggio corto
 *  che comincia con l'assenso (una frase lunga con un «si» dentro non lo è). */
const CONFERMA_INIZIO =
  /^(?:si|ok|okay|va bene|perfetto|confermo|certo|d'accordo|benissimo|ottimo|esatto|ci sono)\b/;
const CONFERMA_OVUNQUE = /\b(?:confermo|va benissimo)\b|👍/;
const MAX_CONFERMA = 60;
const MAX_TESTO = 500;

/** I temi di un messaggio del cliente (testo o link di un media di ManyChat). */
export function temiDi(testo: string | null | undefined): Tema[] {
  const grezzo = (testo ?? "").trim();
  if (!grezzo) return [];
  const tipo = classificaTesto(grezzo.slice(0, 2000)).tipo;
  if (tipo === "immagine" || tipo === "video") return ["foto"];
  const t = normale(grezzo.slice(0, MAX_TESTO));
  const temi: Tema[] = PAROLE.filter(([, re]) => re.test(t)).map(([tema]) => tema);
  if (
    (t.length <= MAX_CONFERMA && CONFERMA_INIZIO.test(t.replace(/^[^a-z]+/, ""))) ||
    CONFERMA_OVUNQUE.test(t)
  )
    temi.push("conferma");
  return temi;
}

/** L'ultimo messaggio scritto dal cliente (anche se dopo abbiamo risposto noi). */
export function ultimoDelCliente(
  messaggi: readonly { direction?: string | null; body?: string | null }[],
): string | null {
  for (let i = messaggi.length - 1; i >= 0; i--) {
    if (messaggi[i].direction === "inbound") return messaggi[i].body ?? null;
  }
  return null;
}

/** Quanto pesa un tema: quelli generici («domani», «ciao», «grazie») meno di
 *  quelli che dicono la domanda vera («non riesco domani, spostiamo?» è uno
 *  spostamento prima che una prenotazione). */
const PESO_TEMA: Partial<Record<Tema, number>> = { saluto: 2, grazie: 4, prenota: 6, info: 6 };
const PESO_TEMA_SPECIFICO = 10;
const PESO_STATO = 5;

const PREDEFINITA = new Map(RISPOSTE_PREDEFINITE.map((r) => [r.id, r]));

/** Le risposte più pertinenti, dalla prima: il tema del messaggio del cliente
 *  pesa più dello stato del lead; a pari punti vale l'ordine salvato. */
export function suggerisci(
  elenco: readonly RispostaRapida[],
  contesto: { ultimoCliente?: string | null; stato?: string | null },
  max = 8,
): RispostaRapida[] {
  const temi = new Set(temiDi(contesto.ultimoCliente));
  const stato = contesto.stato ?? "";
  const punti = (r: RispostaRapida): number => {
    const base = PREDEFINITA.get(r.id);
    let p = 0;
    for (const t of base?.temi ?? []) if (temi.has(t)) p += PESO_TEMA[t] ?? PESO_TEMA_SPECIFICO;
    if (stato && base?.stati?.includes(stato)) p += PESO_STATO;
    return p;
  };
  return elenco
    .map((r, i) => ({ r, i, p: punti(r) }))
    .sort((a, b) => b.p - a.p || a.i - b.i)
    .slice(0, Math.max(0, max))
    .map((x) => x.r);
}

/* ── I SEGNAPOSTO ───────────────────────────────────────────────────────── */

const maiuscola = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Il nome da scrivere: quello della scheda; se manca, il primo nome del contatto. */
export function nomePerMessaggio(nomeScheda?: string | null, nomeContatto?: string | null): string {
  const scheda = (nomeScheda ?? "").trim();
  if (scheda) return scheda;
  return (nomeContatto ?? "").trim().split(/\s+/)[0] ?? "";
}

/** `{nome}` e `{consulente}` (anche `{nome|ripiego}`) riempiti con i dati della chat.
 *  - nome ignoto senza ripiego: sparisce con lo spazio davanti («Buongiorno,»);
 *  - consulente ignoto senza ripiego: resta, e la casella lo segnala;
 *  - gli altri segnaposto ({indirizzo}, {link}) restano: li scrive l'operatore. */
export function riempi(
  testo: string,
  dati: { nome?: string | null; consulente?: string | null },
): string {
  const nome = maiuscola((dati.nome ?? "").trim());
  const consulente = (dati.consulente ?? "").trim();
  return testo
    .replace(/( ?)\{nome(?:\|([^{}]*))?\}/g, (_, spazio: string, ripiego?: string) =>
      nome ? spazio + nome : ripiego !== undefined ? spazio + ripiego : "",
    )
    .replace(
      /\{consulente(?:\|([^{}]*))?\}/g,
      (tutto: string, ripiego?: string) => consulente || (ripiego !== undefined ? ripiego : tutto),
    );
}

/* ── IL VALORE IN app_config ────────────────────────────────────────────── */

const MAX_RISPOSTE = 100;
const MAX_TITOLO = 60;
const MAX_TESTO_RISPOSTA = 2000;
const ID_VALIDO = /^[\w-]{1,40}$/;

/** Una copia dei predefiniti (chi la modifica non tocca l'originale). */
export const ripristinate = (): RispostaRapida[] => RISPOSTE_PREDEFINITE.map((r) => ({ ...r }));

/** Un id che non c'è ancora nell'elenco. */
export function nuovoId(elenco: readonly RispostaRapida[], seme: string): string {
  const usati = new Set(elenco.map((r) => r.id));
  const base = `mia-${seme.replace(/[^\w-]/g, "").slice(0, 30) || "x"}`;
  let id = base;
  for (let n = 2; usati.has(id); n++) id = `${base}-${n}`;
  return id;
}

/** Le risposte salvate, ripulite. Niente o valore rotto: i predefiniti (mai
 *  una casella senza risposte per un errore); un elenco vuoto salvato resta
 *  vuoto (le ha tolte lo studio). I temi non si leggono: vengono dal codice. */
export function leggiRisposte(valore: unknown): RispostaRapida[] {
  let grezzo: unknown = valore;
  if (typeof valore === "string") {
    if (!valore.trim()) return ripristinate();
    try {
      grezzo = JSON.parse(valore);
    } catch {
      return ripristinate();
    }
  }
  const lista =
    grezzo && typeof grezzo === "object" && !Array.isArray(grezzo)
      ? (grezzo as { risposte?: unknown }).risposte
      : grezzo;
  if (!Array.isArray(lista)) return ripristinate();
  if (lista.length === 0) return [];
  const usati = new Set<string>();
  const out: RispostaRapida[] = [];
  for (const v of lista.slice(0, MAX_RISPOSTE)) {
    if (!v || typeof v !== "object") continue;
    const { id, titolo, testo } = v as Record<string, unknown>;
    if (typeof titolo !== "string" || typeof testo !== "string") continue;
    const t = titolo.trim().slice(0, MAX_TITOLO);
    const x = testo.trim().slice(0, MAX_TESTO_RISPOSTA);
    if (!t || !x) continue;
    let idPulito = typeof id === "string" && ID_VALIDO.test(id) && !usati.has(id) ? id : "";
    for (let n = out.length + 1; !idPulito || usati.has(idPulito); n++) idPulito = `r${n}`;
    usati.add(idPulito);
    out.push({ id: idPulito, titolo: t, testo: x });
  }
  return out.length ? out : ripristinate();
}

/** Il valore da salvare: solo id, titolo e testo. */
export const scriviRisposte = (elenco: readonly RispostaRapida[]): string =>
  JSON.stringify({
    v: 1,
    risposte: elenco.map(({ id, titolo, testo }) => ({ id, titolo, testo })),
  });

/** L'elenco con una risposta aggiunta (in fondo) o cambiata (al suo posto). */
export function conRisposta(
  elenco: readonly RispostaRapida[],
  r: RispostaRapida,
): RispostaRapida[] {
  return elenco.some((x) => x.id === r.id)
    ? elenco.map((x) => (x.id === r.id ? r : x))
    : [...elenco, r];
}

/** L'elenco senza una risposta. */
export const senzaRisposta = (elenco: readonly RispostaRapida[], id: string): RispostaRapida[] =>
  elenco.filter((x) => x.id !== id);
