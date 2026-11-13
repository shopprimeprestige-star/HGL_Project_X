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
  /** L'URL firmata di lettura di un file già pronto, o null se non si legge. */
  firmaPonte(percorso: string): Promise<string | null>;
  /** Il file dietro quell'URL, come data URL (mai salvato); null se non si scarica. */
  scaricaPonte(url: string): Promise<string | null>;
  /** Il file dietro un link ManyChat riconosciuto, come data URL (mai salvato,
   *  mai un upload); null se non si scarica. */
  scaricaManyChat(url: string): Promise<string | null>;
}

/* ══ 2. IL RISULTATO ════════════════════════════════════════════════════ */

export interface RaccoltaChat {
  /** Pronto per `corpoRichiestaChat(testo, immagini)` (T2): già tagliato e ordinato. */
  testo: string;
  /** Fino a `MAX_IMMAGINI_CHAT` data URL, le più recenti, in ordine cronologico. */
  immagini: string[];
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

const VUOTA: RaccoltaChat = { testo: "", immagini: [], segnaposto: false };

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
    scarica: () => Promise<string | null>;
  }
  const candidatePonte: Candidata[] = [];
  for (const r of prontePonte) {
    const id = idDaChiave(r.chiave);
    const msg = id ? perId.get(id) : undefined;
    if (!msg) continue; // non confermata come messaggio in entrata: non si scarica, non si indovina
    candidatePonte.push({
      creatoIl: msg.creatoIl,
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
    candidateManyChat.push({ creatoIl: m.creatoIl, scarica: () => porte.scaricaManyChat(url) });
  }

  const scelte = [...candidatePonte, ...candidateManyChat]
    .sort((a, b) => perData(b, a))
    .slice(0, MAX_IMMAGINI_CHAT)
    .sort(perData);

  const immagini: string[] = [];
  for (const cand of scelte) {
    const dataUrl = await cand.scarica();
    if (dataUrl) immagini.push(dataUrl);
  }

  /* ── (c) IL SEGNAPOSTO ────────────────────────────────────────────────── */
  const idConFotoPronta = new Set(
    prontePonte.map((r) => idDaChiave(r.chiave)).filter((id): id is string => !!id),
  );
  const segnaposto = inbound.some((m) => m.mediaType === "foto" && !idConFotoPronta.has(m.id));

  return { testo, immagini, segnaposto };
}
