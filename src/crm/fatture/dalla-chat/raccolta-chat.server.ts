/** ── FATTURE DALLA CHAT · LA RACCOLTA DALLA CHAT ─────────────────────────────
 *  Commessa 2026-11-13-fatture-dalla-chat, T4 (PIANO §2, §4; SPEC §5, §6.7, §8).
 *  `raccogliChat(porte, userId, telefono)`: dato il numero della scheda, prende
 *  dalla chat (ponte Baileys + ManyChat) il testo in entrata e le immagini già
 *  pronte, pronti per `corpoRichiestaChat`/`leggiRispostaChat` (T2). NESSUNA
 *  chiamata all'AI qui dentro: quella (azione `cerca-chat`) sta nella rotta (T5).
 *
 *  ── PERCHÉ «PORTE», COME `bulk.server.ts`/`bulk/emissione.server.ts` ──────
 *  Questo file non importa il client Supabase, non fa `fetch`, non ha una chiave:
 *  ogni accesso al mondo (Supabase, Storage, la rete per i link ManyChat) passa
 *  da `PorteRaccoltaChat`, iniettata da chi chiama. La cablatura vera (il
 *  database, lo Storage, il download) la scrive chi cablerà la rotta (T5),
 *  nello stesso punto in cui oggi `api.crm.fatture-bulk.ts` cabla `PorteBulk` —
 *  non qui. Questo è anche perché si prova senza una sola riga di rete vera.
 *
 *  ── (a) IL TESTO (SPEC §5) ─────────────────────────────────────────────────
 *  Tutti i messaggi IN ENTRATA (mai quelli scritti dal titolare), senza
 *  doppioni (`duplicatoDi`), fino a `MAX_MESSAGGI_TESTO` (300) — i più recenti —
 *  e fino a `MAX_CARATTERI_TESTO` (6000) caratteri: se si supera il tetto si
 *  tolgono i messaggi più VECCHI, uno INTERO alla volta (mai un messaggio
 *  tagliato a metà). Il risultato resta in ordine cronologico crescente, come
 *  vuole `PROMPT_CHAT` («oldest message first»).
 *
 *  ── (b) LE IMMAGINI (SPEC §5) ──────────────────────────────────────────────
 *  Due fonti, nello stesso tetto di `MAX_IMMAGINI_CHAT` (8), le più recenti:
 *   · ponte: righe di `ponte_wa_media` con `stato:"pronta"` e `categoria:"foto"`
 *     la cui chiave (`bw:<numero>:<id>`) combacia con un messaggio IN ENTRATA
 *     già letto (il «join in memoria» del piano: nessuna query in più, si
 *     riusano i messaggi già presi al punto (a) — una foto il cui messaggio non
 *     è fra quelli letti, o che risultasse in uscita, non si scarica: non si
 *     indovina mai la direzione da una riga che non la porta);
 *   · ManyChat: messaggi in entrata il cui testo è un link riconosciuto da
 *     `classificaTesto` (import, non copia: la stessa regola della chat vera).
 *  Ogni immagine scelta costa ESATTAMENTE le chiamate dichiarate nel piano (una
 *  firma + uno scarico per il ponte, uno scarico per ManyChat): mai una firma o
 *  uno scarico per una candidata poi scartata (conta nelle 40 sottorichieste).
 *  Nessun upload, in nessun caso: le foto della chat si leggono e si scartano
 *  (SPEC §4/§5) — questa interfaccia non ha nemmeno un metodo che lo permetta.
 *
 *  ── (c) IL SEGNAPOSTO (SPEC §5) ────────────────────────────────────────────
 *  Vero se esiste almeno un messaggio in entrata `mediaType:"foto"` SENZA una
 *  riga pronta corrispondente: lo dice a chi chiama, che decide se e quando
 *  mostrarlo (la condizione «solo se CF/indirizzo restano vuoti», SPEC §5, è
 *  dell'adattatore T3/T5 — qui si limita il fatto, non l'interpretazione).
 *
 *  ⚠️ PRIVACY: nessun registro (log) in questo file, nemmeno un codice: non
 *   c'è niente da scrivere qui, l'eventuale log sta dove si cablano le porte vere. */
import { classificaTesto } from "../../chatwa/media";
import { MAX_CARATTERI_TESTO, MAX_IMMAGINI_CHAT, MAX_MESSAGGI_TESTO } from "./chiavi";

/* ══ 1. LE PORTE (iniettate, finte nelle prove) ═══════════════════════════ */

/** Una riga di `whatsapp_messages`, letta senza alcun filtro: il filtro (solo
 *  entrata, niente doppioni) lo applica `raccogliChat`, non la porta — così si
 *  prova senza fidarsi ciecamente della query vera. Chi cabla questa porta per
 *  davvero interroga `.eq("direction","inbound").is("duplicato_di", null)
 *  .like("from_number", "%"+ultime9)` (PIANO §4): il filtro qui sotto resta
 *  comunque, a difesa. */
export interface MessaggioChatGrezzo {
  /** `wa_message_id`. */
  id: string;
  direction: "inbound" | "outbound";
  body: string;
  /** `media_type` (`"foto"` per una foto, `null` per un testo normale). */
  mediaType: string | null;
  /** `duplicato_di`: non null = è il doppione di un altro messaggio, si scarta. */
  duplicatoDi: string | null;
  /** `created_at`, ISO. */
  creatoIl: string;
}

/** Una riga di `ponte_wa_media`, letta senza alcun filtro: come sopra, il
 *  filtro (`stato`, `categoria`) lo applica `raccogliChat`. */
export interface MediaPonteGrezzo {
  /** `bw:<numero>:<wa_message_id>`. */
  chiave: string;
  /** Il percorso nel bucket `ponte-media`. */
  percorso: string;
  stato: string;
  categoria: string | null;
}

export interface PorteRaccoltaChat {
  /** Messaggi di quel numero (ultime 9 cifre), qualunque direzione/stato. */
  messaggi(userId: string, ultime9: string): Promise<MessaggioChatGrezzo[]>;
  /** Righe di `ponte_wa_media` di quel numero, qualunque stato/categoria. */
  mediaPonte(userId: string, ultime9: string): Promise<MediaPonteGrezzo[]>;
  /** L'URL firmata di lettura di un file già pronto, o null se non si legge. `secondi` opzionale
   *  (default della cablatura vera: 60 — basta a scaricarla subito per l'AI, T4); la miniatura
   *  (T11.1) passa `FIRMA_LETTURA_S` (300, `ponte/media-tipi.ts`, import) perché quell'indirizzo lo
   *  usa il BROWSER, non il server: stesso meccanismo di firma di `/api/crm/ponte-media`, tempo diverso. */
  firmaPonte(percorso: string, secondi?: number): Promise<string | null>;
  /** Il file dietro quell'URL, come data URL (mai salvato); null se non si scarica. */
  scaricaPonte(url: string): Promise<string | null>;
  /** Il file dietro un link ManyChat riconosciuto, come data URL (mai salvato,
   *  mai un upload); null se non si scarica. */
  scaricaManyChat(url: string): Promise<string | null>;
}

/* ══ 2. IL RISULTATO ════════════════════════════════════════════════════ */

/** La provenienza di UNA immagine scelta (PIANO §0bis.1, T11.1): per il ponte, il solo
 *  `wa_message_id` (non la chiave `bw:…` intera: quella si ritrova da sé, vedi
 *  `percorsoPontePerMiniatura`); per ManyChat, l'URL originale. Stessa forma di `FonteChat`
 *  (`dalla-chat/tipi.ts`), ma definita QUI (non importata): questo file resta generico, come
 *  `MessaggioChatGrezzo`/`MediaPonteGrezzo`, e non si lega ai tipi della rotta. */
export interface FonteChatGrezza {
  tipo: "ponte" | "manychat";
  chiave: string;
}

export interface RaccoltaChat {
  /** Pronto per `corpoRichiestaChat(testo, immagini)` (T2): già tagliato e ordinato. */
  testo: string;
  /** Fino a `MAX_IMMAGINI_CHAT` data URL, le più recenti, in ordine cronologico. */
  immagini: string[];
  /** PARALLELO a `immagini` (stessa lunghezza, stesso ordine, T11.1): la provenienza di ciascuna,
   *  per risolvere poi la miniatura — mai una copia del file. */
  fonti: FonteChatGrezza[];
  /** Vero se c'è almeno una foto non ancora scaricata dal ponte (SPEC §5). */
  segnaposto: boolean;
}

/* ══ 3. LE ULTIME 9 CIFRE ═══════════════════════════════════════════════
 *  Stessa regola della bulk (`bulk/doppioni-e-schede.ts`, `ultime9`): si
 *  riscrive qui, non si importa — lo stesso una riga ripetuta in una decina di
 *  file del CRM (`chatwa/entrata-vera.ts`, `manychat/regole.ts`…), perché è
 *  generica e non vale un accoppiamento fra cartelle diverse. */
function ultime9(telefono: string): string {
  const cifre = String(telefono ?? "").replace(/\D/g, "");
  return cifre.length >= 9 ? cifre.slice(-9) : "";
}

/** Il pezzo-id di una chiave `bw:<numero>:<id>` (PIANO §0.3; `ponte/media-tipi.ts`
 *  ha la stessa forma in `CHIAVE_MEDIA`, non importata per non legare questo
 *  modulo puro a `ponte/`): null se la chiave non ha la forma attesa — una riga
 *  così non si scarica né conta per il segnaposto, non si indovina a chi appartiene. */
function idDaChiave(chiave: string): string | null {
  const m = /^bw:\d{8,15}:([A-Za-z0-9_.-]{1,128})$/.exec(chiave);
  return m ? m[1] : null;
}

/* ══ 4. IL TESTO: 300 MESSAGGI, 6000 CARATTERI, I PIÙ RECENTI ════════════ */

/** Dall'elenco (già in ordine cronologico crescente) si toglie dalla CODA
 *  finché il totale non sta nel tetto — un messaggio alla volta, mai una riga
 *  tagliata a metà; se anche il solo messaggio più recente supera il tetto, si
 *  tiene la sua coda (gli ultimi caratteri, i più recenti anche dentro quel
 *  messaggio). */
function testoEntro(righe: string[], tetto: number): string {
  const scelte: string[] = [];
  let tot = 0;
  for (let i = righe.length - 1; i >= 0; i--) {
    const r = righe[i];
    const giunzione = scelte.length > 0 ? 1 : 0;
    if (tot + giunzione + r.length > tetto) {
      if (scelte.length === 0) scelte.push(r.slice(-tetto));
      break;
    }
    scelte.unshift(r);
    tot += giunzione + r.length;
  }
  return scelte.join("\n");
}

const perData = (a: { creatoIl: string }, b: { creatoIl: string }) =>
  Date.parse(a.creatoIl) - Date.parse(b.creatoIl);

/* ══ 5. LA RACCOLTA ═══════════════════════════════════════════════════════ */

const VUOTA: RaccoltaChat = { testo: "", immagini: [], fonti: [], segnaposto: false };

export async function raccogliChat(
  porte: PorteRaccoltaChat,
  userId: string,
  telefono: string,
): Promise<RaccoltaChat> {
  const nove = ultime9(telefono);
  // Un numero troppo corto non vale una query: è lo stesso esito di «nessuna chat trovata» (SPEC §5),
  // ottenuto qui senza spendere nemmeno una sottorichiesta.
  if (!nove) return VUOTA;

  const grezzi = await porte.messaggi(userId, nove);
  const inbound = grezzi.filter((m) => m.direction === "inbound" && !m.duplicatoDi);

  /* ── (a) IL TESTO ────────────────────────────────────────────────────────
   *  Due tetti INDIPENDENTI (SPEC §5): prima si tengono i 300 messaggi più
   *  recenti (non i 300 caratteri), poi — su quei soli 300, in ordine
   *  cronologico — si tolgono i più vecchi se il totale supera 6000 caratteri. */
  const recenti300 = [...inbound].sort((a, b) => perData(b, a)).slice(0, MAX_MESSAGGI_TESTO);
  const righeTesto = [...recenti300]
    .sort(perData)
    .map((m) => String(m.body ?? "").trim())
    .filter(Boolean);
  const testo = testoEntro(righeTesto, MAX_CARATTERI_TESTO);

  /* ── (b) LE IMMAGINI ──────────────────────────────────────────────────── */
  const perId = new Map(inbound.map((m) => [m.id, m]));
  const grezziMedia = await porte.mediaPonte(userId, nove);
  const prontePonte = grezziMedia.filter((r) => r.stato === "pronta" && r.categoria === "foto");

  interface Candidata {
    creatoIl: string;
    /** La provenienza (T11.1), stessa posizione finale di `immagini`. */
    fonte: FonteChatGrezza;
    scarica: () => Promise<string | null>;
  }
  const candidatePonte: Candidata[] = [];
  for (const r of prontePonte) {
    const id = idDaChiave(r.chiave);
    const msg = id ? perId.get(id) : undefined;
    if (!msg) continue; // non confermata come messaggio in entrata: non si scarica, non si indovina
    candidatePonte.push({
      creatoIl: msg.creatoIl,
      fonte: { tipo: "ponte", chiave: id! },
      scarica: async () => {
        const url = await porte.firmaPonte(r.percorso);
        return url ? porte.scaricaPonte(url) : null;
      },
    });
  }

  const candidateManyChat: Candidata[] = [];
  for (const m of inbound) {
    const k = classificaTesto(m.body);
    if (k.tipo !== "immagine" || !k.url) continue;
    const url = k.url;
    candidateManyChat.push({
      creatoIl: m.creatoIl,
      fonte: { tipo: "manychat", chiave: url },
      scarica: () => porte.scaricaManyChat(url),
    });
  }

  const scelte = [...candidatePonte, ...candidateManyChat]
    .sort((a, b) => perData(b, a))
    .slice(0, MAX_IMMAGINI_CHAT)
    .sort(perData);

  const immagini: string[] = [];
  const fonti: FonteChatGrezza[] = [];
  for (const cand of scelte) {
    const dataUrl = await cand.scarica();
    if (dataUrl) {
      immagini.push(dataUrl);
      fonti.push(cand.fonte);
    }
  }

  /* ── (c) IL SEGNAPOSTO ────────────────────────────────────────────────── */
  const idConFotoPronta = new Set(
    prontePonte.map((r) => idDaChiave(r.chiave)).filter((id): id is string => !!id),
  );
  const segnaposto = inbound.some((m) => m.mediaType === "foto" && !idConFotoPronta.has(m.id));

  return { testo, immagini, fonti, segnaposto };
}

/* ══ 6. LA MINIATURA: DA UNA FONTE «ponte» AL SUO PERCORSO STORAGE (T11.1) ══
 *  `tesseraImmagine`/`indirizzoImmagine` (T2/T3) puntano dentro `fonti`, che per il ponte porta
 *  solo il `wa_message_id` (mai la chiave `bw:…` intera, mai il percorso: non si salva nessuna
 *  copia, SPEC §5): per firmare la miniatura serve ritrovare la riga `ponte_wa_media` ancora
 *  `pronta` con quella chiave — stessa porta `mediaPonte` già usata da `raccogliChat`, nessuna
 *  query nuova. `null` = la foto non è (più) pronta: nessuna miniatura, non un errore
 *  (`chat.server.ts` risponde con un oggetto vuoto, come già fa per il pagamento). */
export async function percorsoPontePerMiniatura(
  porte: PorteRaccoltaChat,
  userId: string,
  telefono: string,
  waMessageId: string,
): Promise<string | null> {
  const nove = ultime9(telefono);
  if (!nove) return null;
  const righe = await porte.mediaPonte(userId, nove);
  const riga = righe.find(
    (r) => r.stato === "pronta" && r.categoria === "foto" && idDaChiave(r.chiave) === waMessageId,
  );
  return riga ? riga.percorso : null;
}

/* ══ 7. LE BOLLE SCELTE (Via 2, T11.3, SPEC §9.3 passo 5, §9.6) ═══════════
 *  `raccogliBolle(porte, userId, telefono, bolle)`: l'OPPOSTO di `raccogliChat` — SOLO le bolle
 *  scelte a mano (fino a 10, validato da chi chiama: `chat.server.ts`), non tutta la chat. Ogni
 *  id si VERIFICA (chiave di servizio) prima di fidarsene: deve appartenere DAVVERO a quel numero
 *  (lo stesso elenco filtrato per numero che già usa `raccogliChat`) ed essere `inbound` —
 *  altrimenti si scarta IN SILENZIO, zero sottorichieste sprecate per quell'id, nessun errore che
 *  confermi o neghi l'esistenza di un id a chi lo indovina (lo stesso principio di `raccogliChat`,
 *  mai fidarsi di un valore che arriva dal browser). */
export interface BollaScelta {
  tipo: "testo" | "immagine";
  /** `wa_message_id`: per il testo è il messaggio stesso; per un'immagine, del ponte o di
   *  ManyChat, è il messaggio che la porta (il ponte la trova per chiave `bw:<numero>:<id>`,
   *  ManyChat per il link dentro `body`). */
  id: string;
}

export interface RaccoltaBolle {
  /** Pronto per `corpoRichiestaChat` (T2): solo i testi delle bolle scelte, uniti con «\n», nello
   *  stesso ordine cronologico delle bolle (non dell'elenco inviato dal browser). */
  testo: string;
  /** Solo le immagini delle bolle scelte (al più quante bolle-immagine sono state scelte). */
  immagini: string[];
  /** PARALLELO a `immagini` (T11.1, stesso principio di `raccogliChat`). */
  fonti: FonteChatGrezza[];
}

export async function raccogliBolle(
  porte: PorteRaccoltaChat,
  userId: string,
  telefono: string,
  bolle: BollaScelta[],
): Promise<RaccoltaBolle> {
  const VUOTA_BOLLE: RaccoltaBolle = { testo: "", immagini: [], fonti: [] };
  const nove = ultime9(telefono);
  if (!nove || bolle.length === 0) return VUOTA_BOLLE;

  const grezzi = await porte.messaggi(userId, nove);
  const inbound = grezzi.filter((m) => m.direction === "inbound" && !m.duplicatoDi);
  const perId = new Map(inbound.map((m) => [m.id, m]));

  // Solo gli id che corrispondono DAVVERO a un messaggio in entrata di QUESTO numero: un id
  // manomesso (di un altro numero, o un nostro messaggio) non entra nemmeno nell'elenco — scartato
  // qui, prima di spendere qualunque altra sottorichiesta per lui.
  const scelte = bolle
    .map((b) => ({ ...b, msg: perId.get(b.id) }))
    .filter((b): b is BollaScelta & { msg: MessaggioChatGrezzo } => !!b.msg);

  const righeTesto = scelte
    .filter((b) => b.tipo === "testo")
    .sort((a, b) => perData(a.msg, b.msg))
    .map((b) => String(b.msg.body ?? "").trim())
    .filter(Boolean);
  const testo = righeTesto.join("\n");

  const immaginiScelte = scelte.filter((b) => b.tipo === "immagine");
  if (immaginiScelte.length === 0) return { testo, immagini: [], fonti: [] };

  // La porta `mediaPonte` si interroga UNA volta sola (come in `raccogliChat`), non una per bolla.
  const grezziMedia = await porte.mediaPonte(userId, nove);
  const prontePerId = new Map<string, MediaPonteGrezzo>();
  for (const r of grezziMedia) {
    if (r.stato !== "pronta" || r.categoria !== "foto") continue;
    const id = idDaChiave(r.chiave);
    if (id) prontePerId.set(id, r);
  }

  interface Candidata {
    creatoIl: string;
    fonte: FonteChatGrezza;
    scarica: () => Promise<string | null>;
  }
  const candidate: Candidata[] = [];
  for (const b of immaginiScelte) {
    const ponte = prontePerId.get(b.id);
    if (ponte) {
      candidate.push({
        creatoIl: b.msg.creatoIl,
        fonte: { tipo: "ponte", chiave: b.id },
        scarica: async () => {
          const url = await porte.firmaPonte(ponte.percorso);
          return url ? porte.scaricaPonte(url) : null;
        },
      });
      continue;
    }
    const k = classificaTesto(b.msg.body);
    if (k.tipo === "immagine" && k.url) {
      const url = k.url;
      candidate.push({
        creatoIl: b.msg.creatoIl,
        fonte: { tipo: "manychat", chiave: url },
        scarica: () => porte.scaricaManyChat(url),
      });
    }
    // Né un ponte PRONTO né un link ManyChat riconosciuto: l'immagine scelta non si legge (un
    // segnaposto non ancora scaricato, o non era affatto un'immagine) — si scarta in silenzio,
    // nessuna sottorichiesta sprecata (niente firma, niente scarico per questa bolla).
  }

  const immagini: string[] = [];
  const fonti: FonteChatGrezza[] = [];
  for (const cand of candidate.sort((a, b) => perData(a, b))) {
    const dataUrl = await cand.scarica();
    if (dataUrl) {
      immagini.push(dataUrl);
      fonti.push(cand.fonte);
    }
  }
  return { testo, immagini, fonti };
}
