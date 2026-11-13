/** ── FATTURE DALLA CHAT · T11.3 · LA LETTURA DELLE SOLE BOLLE SCELTE ────────
 *  Commessa 2026-11-13-fatture-dalla-chat (SPEC §9.3 passo 5, §9.6, §9.7
 *  criterio 1; PIANO §3bis, T11.3). Due livelli:
 *   A. `raccogliBolle` (`raccolta-chat.server.ts`): SOLO le bolle scelte, un
 *      id manomesso (outbound o di un altro numero) si scarta in silenzio.
 *   B. `leggi-bolle` (`chat.server.ts`): il contratto vero sulla rotta — 1-10
 *      bolle, il contenuto mandato all'AI è ESATTAMENTE quello delle bolle
 *      scelte (non il resto della chat), e il caso peggiore (10 immagini)
 *      sta sotto le 40 sottorichieste (misurato per davvero, non calcolato).
 *  PORTE SEMPRE FINTE: nessun Supabase, nessuna rete, nessuna chiave. */
import { createRequire } from "node:module";
import { join } from "node:path";
import { LOTTO_PROVA, SCHEDA_PROVA } from "./dati.mjs";
import { CF_PROVA } from "../fatture-bulk/dati.mjs";

async function impacchetta(radice, percorsoRelativo) {
  const esbuild = createRequire(import.meta.url)("esbuild");
  const risultato = esbuild.buildSync({
    entryPoints: [join(radice, percorsoRelativo)],
    bundle: true,
    format: "esm",
    platform: "node",
    write: false,
    logLevel: "silent",
  });
  const testo = risultato.outputFiles[0].text;
  return import(`data:text/javascript;base64,${Buffer.from(testo).toString("base64")}`);
}

const L = LOTTO_PROVA;
const U = "utente-prova";
const T0 = Date.parse("2026-11-13T10:00:00.000Z");

const msgGrezzo = (id, creatoIl, body, extra = {}) => ({
  id,
  direction: "inbound",
  body,
  mediaType: null,
  duplicatoDi: null,
  creatoIl,
  ...extra,
});
const mediaGrezza = (chiave, percorso, extra = {}) => ({
  chiave,
  percorso,
  stato: "pronta",
  categoria: "foto",
  ...extra,
});

/* ══ A. raccogliBolle in isolamento (porte minime, i loro contatori) ═══════ */
function fintePorteBolle({ messaggi = [], media = [], scarichi = {} } = {}) {
  const chiamate = {
    messaggi: 0,
    mediaPonte: 0,
    firmaPonte: 0,
    scaricaPonte: 0,
    scaricaManyChat: 0,
  };
  const porte = {
    async messaggi() {
      chiamate.messaggi++;
      return messaggi;
    },
    async mediaPonte() {
      chiamate.mediaPonte++;
      return media;
    },
    async firmaPonte(percorso) {
      chiamate.firmaPonte++;
      return `https://firmato.example/${percorso}`;
    },
    async scaricaPonte(url) {
      chiamate.scaricaPonte++;
      return url in scarichi ? scarichi[url] : `data:image/jpeg;base64,${"A".repeat(40)}`;
    },
    async scaricaManyChat() {
      chiamate.scaricaManyChat++;
      return `data:image/jpeg;base64,${"B".repeat(40)}`;
    },
  };
  return { porte, chiamate };
}
const TOT = (chiamate) => Object.values(chiamate).reduce((a, b) => a + b, 0);

/* ══ B. chat.server.ts: mondo finto CON CONTEGGIO VERO delle sottorichieste
 *  (stesso schema, approvato dal revisore, di prove/fatture-dalla-chat/server.mjs: ogni porta —
 *  non solo archivio/lucchetto/bucket — chiama sub(), altrimenti il tetto delle 40 si misura sul
 *  nulla, come l'osservazione bloccante già fatta su T5). ═══════════════════ */
function mondo(opz = {}) {
  const m = new Map();
  const reg = { subs: 0, ai: 0, aiCorpi: [], raccoltaFirme: 0, raccoltaScarichi: 0, log: [] };
  const w = { m, reg, ora: T0, n: 0, schede: new Map() };
  w.id = () => `00000000-0000-4000-8000-${String(++w.n).padStart(12, "0")}`;
  const sub = (k = 1) => (reg.subs += k);
  const archivio = {
    leggi: async (k) => {
      sub();
      return m.get(k) ?? null;
    },
    leggiPrefisso: async (p) => {
      sub();
      return [...m].filter(([k]) => k.startsWith(p)).map(([key, value]) => ({ key, value }));
    },
    leggiPrefissoPerChiave: async (p) => {
      sub();
      return [...m].filter(([k]) => k.startsWith(p)).map(([key, value]) => ({ key, value }));
    },
    leggiMolte: async (ks) => {
      sub();
      return ks.filter((k) => m.has(k)).map((k) => ({ key: k, value: m.get(k) }));
    },
    scrivi: async (k, v) => {
      sub();
      m.set(k, v);
      return null;
    },
    elimina: async (k) => {
      sub();
      m.delete(k);
      return null;
    },
    creaSeAssente: async (k, v) => {
      sub();
      if (m.has(k)) return { stato: "esiste" };
      m.set(k, v);
      return { stato: "creata" };
    },
    eliminaPerPrefisso: async (p) => {
      sub();
      for (const k of [...m.keys()]) if (k.startsWith(p)) m.delete(k);
      return null;
    },
  };
  const lucchetto = {
    leggi: async (k) => {
      sub();
      return m.get(k) ?? null;
    },
    creaSeAssente: async (k, v) => {
      sub();
      if (m.has(k)) return false;
      m.set(k, v);
      return true;
    },
    sostituisciSe: async (k, a, n) => {
      sub();
      if (m.get(k) !== a) return false;
      m.set(k, n);
      return true;
    },
    eliminaSe: async (k, a) => {
      sub();
      if (m.get(k) !== a) return false;
      m.delete(k);
      return true;
    },
  };
  const bucket = {
    carica: async () => {
      sub();
      return null;
    },
    scarica: async () => {
      sub();
      return null;
    },
    elenca: async () => {
      sub();
      return [];
    },
    rimuovi: async () => {
      sub();
      return null;
    },
    firma: async () => {
      sub();
      return "https://firmato.example/pagamento";
    },
  };
  const raccolta = {
    messaggi: async () => {
      sub();
      return opz.raccoltaMessaggi ?? [];
    },
    mediaPonte: async () => {
      sub();
      return opz.raccoltaMedia ?? [];
    },
    firmaPonte: async (percorso) => {
      sub();
      reg.raccoltaFirme++;
      return `https://firmato.example/${percorso}`;
    },
    scaricaPonte: async () => {
      sub();
      reg.raccoltaScarichi++;
      return `data:image/jpeg;base64,${"A".repeat(40)}`;
    },
    scaricaManyChat: async () => {
      sub();
      return `data:image/jpeg;base64,${"B".repeat(40)}`;
    },
  };
  const ai = async (corpo, timeoutMs) => {
    sub();
    reg.ai++;
    reg.aiCorpi.push(corpo);
    if (opz.risposteAi) return opz.risposteAi(corpo, reg.ai, timeoutMs);
    return { testo: '{"tessere":[],"indirizzi":[]}', fine: "stop" };
  };
  w.porte = {
    archivio,
    lucchetto,
    bucket,
    raccolta,
    ai,
    adesso: () => w.ora,
    id: w.id,
    log: (c) => reg.log.push(c),
    utente: U,
    schede: async () => [...w.schede.values()],
    scheda: async (id) => w.schede.get(id) ?? null,
  };
  return w;
}

function aggiungiScheda(w, id, extra = {}) {
  w.schede.set(id, {
    id,
    nome: "Mario",
    cognome: "Rossi",
    telefono: "+39 333 123 4567",
    payment: {
      accontoPagato: 100,
      statoPagamento: "acconto_ricevuto",
      dataPagamento: "2026-11-01",
    },
    codiceFiscale: "",
    ...extra,
  });
}

const dip = (w) => ({
  guardia: async () => ({ ok: true, utente: U }),
  porte: () => w.porte,
  emettiRiga: async () => ({ ok: true, esito: "ferma", codice: "interno", messaggio: "finto" }),
});
const richiesta = (metodo, corpo, query = "") =>
  new Request(`http://localhost/api/crm/fatture-chat${query}`, {
    method: metodo,
    ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }),
  });
const testataLotto = () =>
  JSON.stringify({
    lotto: L,
    creatoIl: new Date(T0).toISOString(),
    descrizione: "x",
    dataSeManca: "",
    firmaImpostazioni: "f",
  });

export async function prove(_mod, { c, gruppo, radice }) {
  const R = await impacchetta(radice, "src/crm/fatture/dalla-chat/raccolta-chat.server.ts");
  const CS = await impacchetta(radice, "src/crm/fatture/dalla-chat/chat.server.ts");

  /* ══ A. raccogliBolle in isolamento ══════════════════════════════════════ */
  gruppo("DALLA CHAT · T11.3 · raccogliBolle legge SOLO le bolle scelte");
  {
    const chiavePonte = "bw:33312345678:msg-img-1";
    const { porte, chiamate } = fintePorteBolle({
      messaggi: [
        msgGrezzo("msg-testo-1", "2026-11-01T10:00:00.000Z", "Via Garibaldi 10, 00100 Roma"),
        msgGrezzo("msg-img-1", "2026-11-02T10:00:00.000Z", "", { mediaType: "foto" }),
        // Una TERZA bolla, con un testo distinguibile, NON scelta: non deve entrare nel risultato.
        msgGrezzo("msg-non-scelto", "2026-11-03T10:00:00.000Z", "SEGRETO-NON-SCELTO"),
      ],
      media: [mediaGrezza(chiavePonte, "ponte/msg-img-1.jpg")],
    });
    const r = await R.raccogliBolle(porte, "u1", "+393331234567", [
      { tipo: "testo", id: "msg-testo-1" },
      { tipo: "immagine", id: "msg-img-1" },
    ]);
    c("testo = solo quello della bolla scelta", "Via Garibaldi 10, 00100 Roma", r.testo);
    c("il testo NON scelto non entra", false, r.testo.includes("SEGRETO-NON-SCELTO"));
    c("1 sola immagine (quella scelta)", 1, r.immagini.length);
    c(
      "fonte: tipo ponte, chiave = wa_message_id",
      true,
      r.fonti[0]?.tipo === "ponte" && r.fonti[0]?.chiave === "msg-img-1",
    );
    c("mediaPonte interrogata UNA sola volta (non una per bolla)", 1, chiamate.mediaPonte);
  }

  gruppo(
    "DALLA CHAT · T11.3 · un id OUTBOUND (manomesso) si scarta in silenzio, zero sottorichieste sprecate",
  );
  {
    const { porte, chiamate } = fintePorteBolle({
      messaggi: [
        msgGrezzo("msg-testo-1", "2026-11-01T10:00:00.000Z", "Via Vera 1"),
        msgGrezzo("msg-nostro", "2026-11-02T10:00:00.000Z", "Via Finta 99", {
          direction: "outbound",
        }),
      ],
    });
    const r = await R.raccogliBolle(porte, "u1", "+393331234567", [
      { tipo: "testo", id: "msg-testo-1" },
      { tipo: "testo", id: "msg-nostro" },
    ]);
    c("solo il testo VERO (in entrata) entra", "Via Vera 1", r.testo);
    c("il testo del nostro messaggio non entra mai", false, r.testo.includes("Via Finta 99"));
  }

  gruppo(
    "DALLA CHAT · T11.3 · un'immagine scelta ma non ancora scaricata (segnaposto) si scarta, senza errori",
  );
  {
    const { porte } = fintePorteBolle({
      messaggi: [msgGrezzo("msg-img-1", "2026-11-01T10:00:00.000Z", "", { mediaType: "foto" })],
      media: [mediaGrezza("bw:33312345678:msg-img-1", "ponte/x.jpg", { stato: "in_caricamento" })],
    });
    const r = await R.raccogliBolle(porte, "u1", "+393331234567", [
      { tipo: "immagine", id: "msg-img-1" },
    ]);
    c("nessuna immagine (il segnaposto non si legge)", 0, r.immagini.length);
    c("nessuna fonte", 0, r.fonti.length);
  }

  gruppo("DALLA CHAT · T11.3 · solo bolle di testo scelte → mediaPonte non si interroga neanche");
  {
    const { porte, chiamate } = fintePorteBolle({
      messaggi: [msgGrezzo("msg-testo-1", "2026-11-01T10:00:00.000Z", "Solo testo")],
    });
    await R.raccogliBolle(porte, "u1", "+393331234567", [{ tipo: "testo", id: "msg-testo-1" }]);
    c("mediaPonte: zero chiamate (nessuna bolla-immagine scelta)", 0, chiamate.mediaPonte);
  }

  gruppo(
    "DALLA CHAT · T11.3 · numero troppo corto o nessuna bolla → risultato vuoto, zero chiamate",
  );
  {
    const { porte, chiamate } = fintePorteBolle({
      messaggi: [msgGrezzo("x", "2026-11-01T10:00:00.000Z", "non deve arrivare qui")],
    });
    const r1 = await R.raccogliBolle(porte, "u1", "123", [{ tipo: "testo", id: "x" }]);
    c("numero troppo corto → vuoto", true, r1.testo === "" && r1.immagini.length === 0);
    const r2 = await R.raccogliBolle(porte, "u1", "+393331234567", []);
    c("nessuna bolla → vuoto", true, r2.testo === "" && r2.immagini.length === 0);
    c("zero sottorichieste in entrambi i casi", 0, TOT(chiamate));
  }

  /* ══ B. L'azione «leggi-bolle» sulla rotta vera ═══════════════════════════ */
  gruppo(
    "DALLA CHAT · T11.3 · «leggi-bolle»: l'AI riceve SOLO le immagini delle bolle scelte, non il resto della chat",
  );
  {
    const chiaveScelta = "bw:33312345678:msg-img-scelta";
    const chiaveNonScelta = "bw:33312345678:msg-img-altra";
    const w = mondo({
      risposteAi: () => ({
        testo: JSON.stringify({
          tessere: [
            { nome: "Mario", cognome: "Rossi", codiceFiscale: CF_PROVA, immagine: 1, incerti: [] },
          ],
          indirizzi: [],
        }),
        fine: "stop",
      }),
    });
    w.m.set(`chat_fatture_t:${L}`, testataLotto());
    aggiungiScheda(w, SCHEDA_PROVA);
    await CS.gestisciPOSTChat(
      richiesta("POST", { azione: "aggiungi-cliente", lotto: L, schedaId: SCHEDA_PROVA }),
      dip(w),
    );
    // La chat VERA ha anche una tessera di un'ALTRA persona, in un messaggio NON scelto: non deve
    // mai arrivare all'AI (SPEC: «la stessa non entra mai»).
    const porteOriginali = w.porte.raccolta;
    w.porte = {
      ...w.porte,
      raccolta: {
        ...porteOriginali,
        messaggi: async () => {
          w.reg.subs += 1;
          return [
            msgGrezzo("msg-img-scelta", "2026-11-01T10:00:00.000Z", "", { mediaType: "foto" }),
            msgGrezzo("msg-img-altra", "2026-11-02T10:00:00.000Z", "", { mediaType: "foto" }),
            msgGrezzo("msg-testo-indirizzo", "2026-11-03T10:00:00.000Z", "Via Roma 1, 00100 Roma"),
          ];
        },
        mediaPonte: async () => {
          w.reg.subs += 1;
          return [
            mediaGrezza(chiaveScelta, "ponte/scelta.jpg"),
            mediaGrezza(chiaveNonScelta, "ponte/altra.jpg"),
          ];
        },
      },
    };
    const r = await CS.gestisciPOSTChat(
      richiesta("POST", {
        azione: "leggi-bolle",
        lotto: L,
        idRiga: SCHEDA_PROVA,
        bolle: [
          { tipo: "immagine", id: "msg-img-scelta" },
          { tipo: "testo", id: "msg-testo-indirizzo" },
        ],
      }),
      dip(w),
    );
    const corpo = await r.json();
    c("ok: true, riga letta", true, corpo.ok === true && corpo.azione === "leggi-bolle");
    c("CF trovato", true, !!corpo.riga?.chat?.tessera);
    const immaginiMandate =
      w.reg.aiCorpi.at(-1)?.messages?.[0]?.content?.filter((x) => x.type === "image_url") ?? [];
    c(
      "all'AI è arrivata ESATTAMENTE 1 immagine (solo quella scelta, non le altre della chat)",
      1,
      immaginiMandate.length,
    );
  }

  gruppo("DALLA CHAT · T11.3 · 11 bolle → richiesta_non_valida, zero scritture (tetto SPEC §9.6)");
  {
    const w = mondo();
    w.m.set(`chat_fatture_t:${L}`, testataLotto());
    aggiungiScheda(w, SCHEDA_PROVA);
    await CS.gestisciPOSTChat(
      richiesta("POST", { azione: "aggiungi-cliente", lotto: L, schedaId: SCHEDA_PROVA }),
      dip(w),
    );
    const prima = w.reg.subs;
    const bolle = Array.from({ length: 11 }, (_, i) => ({ tipo: "testo", id: `msg-${i}` }));
    const r = await CS.gestisciPOSTChat(
      richiesta("POST", { azione: "leggi-bolle", lotto: L, idRiga: SCHEDA_PROVA, bolle }),
      dip(w),
    );
    const corpo = await r.json();
    c("richiesta_non_valida", true, corpo.ok === false && corpo.codice === "richiesta_non_valida");
    c("zero chiamate AI (scartata prima di leggere niente)", 0, w.reg.ai);
    c("zero sottorichieste in più rispetto a prima della richiesta", prima, w.reg.subs);
  }

  gruppo(
    "DALLA CHAT · T11.3 · nel caso peggiore (10 immagini scelte) il conteggio sta sotto le 40 sottorichieste",
  );
  {
    const idImg = (n) => `msg-bolla-${n}`;
    const chiaveMedia = (n) => `bw:33312345678:${idImg(n)}`;
    const messaggiProva = Array.from({ length: 10 }, (_, i) =>
      msgGrezzo(idImg(i), new Date(T0 - (10 - i) * 60_000).toISOString(), "", {
        mediaType: "foto",
      }),
    );
    const mediaProva = Array.from({ length: 10 }, (_, i) =>
      mediaGrezza(chiaveMedia(i), `ponte/${idImg(i)}.jpg`),
    );
    const w = mondo({
      risposteAi: () => ({ testo: '{"tessere":[],"indirizzi":[]}', fine: "stop" }),
      raccoltaMessaggi: messaggiProva,
      raccoltaMedia: mediaProva,
    });
    w.m.set(`chat_fatture_t:${L}`, testataLotto());
    aggiungiScheda(w, SCHEDA_PROVA);
    await CS.gestisciPOSTChat(
      richiesta("POST", { azione: "aggiungi-cliente", lotto: L, schedaId: SCHEDA_PROVA }),
      dip(w),
    );
    w.reg.subs = 0;
    const bolle = Array.from({ length: 10 }, (_, i) => ({ tipo: "immagine", id: idImg(i) }));
    const r = await CS.gestisciPOSTChat(
      richiesta("POST", { azione: "leggi-bolle", lotto: L, idRiga: SCHEDA_PROVA, bolle }),
      dip(w),
    );
    const corpo = await r.json();
    c("la riga esce letta (nessun errore nel caso peggiore)", true, corpo.ok === true);
    c(
      "le 10 immagini sono state davvero scaricate (10 firme, 10 scarichi)",
      true,
      w.reg.raccoltaFirme === 10 && w.reg.raccoltaScarichi === 10,
    );
    c("1 sola chiamata AI", 1, w.reg.ai);
    c(
      "il conteggio misura per davvero il lavoro (non è rimasto vicino a zero)",
      true,
      w.reg.subs >= 20,
    );
    c("leggi-bolle nel caso peggiore (10 immagini): ≤ 40 sottorichieste", true, w.reg.subs <= 40);
  }
}
