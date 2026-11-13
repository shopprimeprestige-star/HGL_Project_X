/** ── FATTURE DALLA CHAT · T11.1 · LA PROVENIENZA DELLE MINIATURE ───────────
 *  Commessa 2026-11-13-fatture-dalla-chat (PIANO §0bis.1, T11.1). Tre livelli:
 *   A. `lettura-chat.ts` (T2): `immagineDi`, e `sceglici`/`sceglindirizzo` che
 *      tornano, in più, l'indice (1-based) dell'immagine scelta.
 *   B. `raccolta-chat.server.ts` (T4): `raccogliChat` produce `fonti`
 *      (parallelo a `immagini`), e `percorsoPontePerMiniatura` la ritrova.
 *   C. `chat.server.ts` (T5): `cerca-chat` salva `tesseraImmagine`/
 *      `indirizzoImmagine`/`fonti` dentro `chat_fatture_r`; la GET
 *      `?miniatura=tessera|indirizzo` firma con `FIRMA_LETTURA_S` (300 s,
 *      import da `ponte/media-tipi.ts` — non una costante propria).
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
const FIRMA_LETTURA_S_ATTESA = 300; // `ponte/media-tipi.ts`, verificato anche a parte sotto.

/* ══ MONDO FINTO (stesso schema di prove/fatture-dalla-chat/server.mjs) ═════ */
function mondo(opz = {}) {
  const m = new Map();
  const reg = { ai: 0, firmePonte: [] };
  const w = { m, reg, ora: T0, n: 0, schede: new Map() };
  w.id = () => `00000000-0000-4000-8000-${String(++w.n).padStart(12, "0")}`;
  const archivio = {
    leggi: async (k) => m.get(k) ?? null,
    leggiPrefisso: async (p) =>
      [...m].filter(([k]) => k.startsWith(p)).map(([key, value]) => ({ key, value })),
    leggiPrefissoPerChiave: async (p) =>
      [...m].filter(([k]) => k.startsWith(p)).map(([key, value]) => ({ key, value })),
    leggiMolte: async (ks) => ks.filter((k) => m.has(k)).map((k) => ({ key: k, value: m.get(k) })),
    scrivi: async (k, v) => {
      m.set(k, v);
      return null;
    },
    elimina: async (k) => {
      m.delete(k);
      return null;
    },
    creaSeAssente: async (k, v) => {
      if (m.has(k)) return { stato: "esiste" };
      m.set(k, v);
      return { stato: "creata" };
    },
    eliminaPerPrefisso: async (p) => {
      for (const k of [...m.keys()]) if (k.startsWith(p)) m.delete(k);
      return null;
    },
  };
  const lucchetto = {
    leggi: async (k) => m.get(k) ?? null,
    creaSeAssente: async (k, v) => {
      if (m.has(k)) return false;
      m.set(k, v);
      return true;
    },
    sostituisciSe: async (k, a, n) => {
      if (m.get(k) !== a) return false;
      m.set(k, n);
      return true;
    },
    eliminaSe: async (k, a) => {
      if (m.get(k) !== a) return false;
      m.delete(k);
      return true;
    },
  };
  const bucket = {
    carica: async () => null,
    scarica: async () => null,
    elenca: async () => [],
    rimuovi: async () => null,
    firma: async () => "https://firmato.example/pagamento",
  };
  const raccolta = {
    messaggi: async () => opz.raccoltaMessaggi ?? [],
    mediaPonte: async () => opz.raccoltaMedia ?? [],
    firmaPonte: async (percorso, secondi) => {
      reg.firmePonte.push({ percorso, secondi });
      return `https://firmato.example/${percorso}?s=${secondi ?? 60}`;
    },
    scaricaPonte: async () => `data:image/jpeg;base64,${"A".repeat(100)}`,
    scaricaManyChat: async () => `data:image/jpeg;base64,${"B".repeat(100)}`,
  };
  const ai = async (corpo) => {
    reg.ai++;
    if (opz.risposteAi) return opz.risposteAi(corpo, reg.ai);
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
    log: () => {},
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

/* ══ UN MESSAGGIO/UNA RIGA MEDIA GREZZI (stessa forma di raccolta.mjs/server.mjs) ══ */
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
const URL_MANYCHAT = "https://manybot-files.s3.amazonaws.com/pagina1/wa/2026/11/10/foto.jpg";

export async function prove(_mod, { c, gruppo, radice }) {
  const L2 = await impacchetta(radice, "src/crm/fatture/dalla-chat/lettura-chat.ts");
  const R = await impacchetta(radice, "src/crm/fatture/dalla-chat/raccolta-chat.server.ts");
  const CS = await impacchetta(radice, "src/crm/fatture/dalla-chat/chat.server.ts");

  /* ══ A. lettura-chat.ts: immagineDi, sceglici/sceglindirizzo ══════════════ */
  gruppo("DALLA CHAT · T11.1 · immagineDi: solo un intero ≥1, altrimenti assente");
  {
    c("immagine:3 → 3", 3, L2.immagineDi({ immagine: 3 }));
    c("senza immagine → undefined", undefined, L2.immagineDi({}));
    c("immagine:0 → undefined (non 1-based)", undefined, L2.immagineDi({ immagine: 0 }));
    c("immagine:-1 → undefined", undefined, L2.immagineDi({ immagine: -1 }));
    c('immagine:"3" (stringa) → undefined', undefined, L2.immagineDi({ immagine: "3" }));
    c("immagine:2.5 (non intero) → undefined", undefined, L2.immagineDi({ immagine: 2.5 }));
  }

  const SCHEDA_SCELTA = { nome: "Mario", cognome: "Rossi" };
  const tessera = (cf, extra = {}) => ({
    tipo: "tessera",
    nome: "x",
    cognome: "y",
    codiceFiscale: cf,
    cfLetto: cf,
    incerti: [],
    ...extra,
  });
  const indirizzo = (comune, extra = {}) => ({
    tipo: "indirizzo",
    indirizzo: "Via Roma 1",
    cap: "00100",
    comune,
    provincia: "RM",
    telefono: "",
    nome: "",
    cognome: "",
    indirizzoDiSpedizione: false,
    incerti: [],
    ...extra,
  });

  gruppo("DALLA CHAT · T11.1 · sceglici porta avanti l'indice della tessera scelta");
  {
    const r1 = L2.sceglici([tessera(CF_PROVA)], SCHEDA_SCELTA, [3]);
    c("CF trovato da un'immagine → immagine=3", 3, r1.immagine);
    const r2 = L2.sceglici([tessera(CF_PROVA)], SCHEDA_SCELTA, [undefined]);
    c("CF letto da TESTO (nessun indice) → .immagine assente", undefined, r2.immagine);
    const r3 = L2.sceglici([tessera(CF_PROVA)], SCHEDA_SCELTA);
    c(
      "senza il 3° argomento (retrocompatibile) → .immagine assente, campo comunque trovato",
      true,
      r3.immagine === undefined && !!r3.campo,
    );
    const r4 = L2.sceglici([tessera(CF_PROVA), tessera("ALTRO_CF_VALIDO")], SCHEDA_SCELTA, [1, 2]);
    c("più CF diversi → avviso, nessuna .immagine (non si indovina quale)", undefined, r4.immagine);
  }

  gruppo("DALLA CHAT · T11.1 · sceglindirizzo porta avanti l'indice dell'indirizzo scelto");
  {
    const r1 = L2.sceglindirizzo([indirizzo("Roma")], [5]);
    c("indirizzo trovato da un'immagine → immagine=5", 5, r1.immagine);
    const r2 = L2.sceglindirizzo([indirizzo("Roma")], [undefined]);
    c("indirizzo letto da TESTO → .immagine assente", undefined, r2.immagine);
    // Due indirizzi nello stesso comune (solo civico diverso): vince l'ULTIMO della lista — e con
    // lui la SUA provenienza, non quella del primo.
    const r3 = L2.sceglindirizzo(
      [indirizzo("Roma", { indirizzo: "Via A 1" }), indirizzo("Roma", { indirizzo: "Via A 2" })],
      [1, 4],
    );
    c("più indirizzi, stesso comune → immagine dell'ULTIMO (il più recente)", 4, r3.immagine);
    const r4 = L2.sceglindirizzo([indirizzo("Roma"), indirizzo("Milano")], [1, 2]);
    c("comuni diversi → avviso, nessuna .immagine", undefined, r4.immagine);
  }

  /* ══ B. raccolta-chat.server.ts: fonti, percorsoPontePerMiniatura ════════ */
  gruppo("DALLA CHAT · T11.1 · raccogliChat produce `fonti`, parallelo a `immagini`");
  {
    const idPonte = "msg-ponte-1";
    const chiavePonte = `bw:33312345678:${idPonte}`;
    const messaggi = [
      msgGrezzo(idPonte, "2026-11-01T10:00:00.000Z", "", { mediaType: "foto" }),
      msgGrezzo("msg-manychat-1", "2026-11-02T10:00:00.000Z", URL_MANYCHAT),
    ];
    const media = [mediaGrezza(chiavePonte, "ponte/msg-ponte-1.jpg")];
    const porte = {
      messaggi: async () => messaggi,
      mediaPonte: async () => media,
      firmaPonte: async (p) => `https://firmato.example/${p}`,
      scaricaPonte: async () => `data:image/jpeg;base64,${"A".repeat(50)}`,
      scaricaManyChat: async () => `data:image/jpeg;base64,${"B".repeat(50)}`,
    };
    const r = await R.raccogliChat(porte, "u1", "+393331234567");
    c("2 immagini scaricate (1 ponte + 1 manychat)", 2, r.immagini.length);
    c("fonti ha la STESSA lunghezza di immagini", r.immagini.length, r.fonti.length);
    c(
      "fonte 1 (ponte): tipo ponte, chiave = wa_message_id (non la chiave bw:…)",
      true,
      r.fonti[0].tipo === "ponte" && r.fonti[0].chiave === idPonte,
    );
    c(
      "fonte 2 (manychat): tipo manychat, chiave = l'URL",
      true,
      r.fonti[1].tipo === "manychat" && r.fonti[1].chiave === URL_MANYCHAT,
    );
  }

  gruppo("DALLA CHAT · T11.1 · fonti non supera mai le 8 immagini (SPEC §5)");
  {
    const messaggi = Array.from({ length: 9 }, (_, i) =>
      msgGrezzo(`m${i}`, new Date(T0 - (9 - i) * 60_000).toISOString(), "", { mediaType: "foto" }),
    );
    const media = Array.from({ length: 9 }, (_, i) =>
      mediaGrezza(`bw:33312345678:m${i}`, `ponte/m${i}.jpg`),
    );
    const porte = {
      messaggi: async () => messaggi,
      mediaPonte: async () => media,
      firmaPonte: async (p) => `https://firmato.example/${p}`,
      scaricaPonte: async () => `data:image/jpeg;base64,${"A".repeat(50)}`,
      scaricaManyChat: async () => null,
    };
    const r = await R.raccogliChat(porte, "u1", "+393331234567");
    c("9 foto pronte → al massimo 8 immagini", 8, r.immagini.length);
    c("fonti: anche lei al massimo 8", 8, r.fonti.length);
  }

  gruppo(
    "DALLA CHAT · T11.1 · percorsoPontePerMiniatura ritrova il percorso dalla sola provenienza",
  );
  {
    const media = [
      mediaGrezza("bw:33312345678:msg-a", "ponte/msg-a.jpg"),
      mediaGrezza("bw:33312345678:msg-b", "ponte/msg-b.jpg", { stato: "in_caricamento" }),
    ];
    let chiamateMedia = 0;
    const porte = {
      mediaPonte: async () => {
        chiamateMedia++;
        return media;
      },
    };
    const p1 = await R.percorsoPontePerMiniatura(porte, "u1", "+393331234567", "msg-a");
    c("foto ancora pronta → il suo percorso", "ponte/msg-a.jpg", p1);
    const p2 = await R.percorsoPontePerMiniatura(porte, "u1", "+393331234567", "msg-b");
    c("foto NON più pronta (es. liberata) → null, non un errore", null, p2);
    const p3 = await R.percorsoPontePerMiniatura(porte, "u1", "+393331234567", "msg-inesistente");
    c("id che non combacia con nessuna riga → null", null, p3);
    const p4 = await R.percorsoPontePerMiniatura(porte, "u1", "123", "msg-a");
    c("numero troppo corto → null, zero chiamate in più (non si indovina)", true, p4 === null);
    c("nessuna chiamata sprecata per il numero troppo corto", 3, chiamateMedia);
  }

  /* ══ C. chat.server.ts: cerca-chat salva la provenienza; la GET la firma ═══ */
  gruppo("DALLA CHAT · T11.1 · «cerca-chat» salva tesseraImmagine/indirizzoImmagine/fonti");
  {
    const idPonte = "msg-tessera-1";
    const chiavePonte = `bw:33312345678:${idPonte}`;
    const w = mondo({
      // La tessera (CF valido) dichiara di venire dalla 1ª immagine; l'indirizzo dalla 2ª
      // (manychat). Un 3° campo con un indice FUORI dal pacchetto (99) si scarta da solo.
      risposteAi: () => ({
        testo: JSON.stringify({
          tessere: [
            { nome: "Mario", cognome: "Rossi", codiceFiscale: CF_PROVA, immagine: 1, incerti: [] },
          ],
          indirizzi: [
            {
              indirizzo: "Via Roma 1",
              cap: "00100",
              comune: "Roma",
              provincia: "RM",
              immagine: 2,
              incerti: [],
            },
          ],
        }),
        fine: "stop",
      }),
      raccoltaMessaggi: [
        msgGrezzo(idPonte, "2026-11-01T10:00:00.000Z", "", { mediaType: "foto" }),
        msgGrezzo("msg-manychat-1", "2026-11-02T10:00:00.000Z", URL_MANYCHAT),
      ],
      raccoltaMedia: [mediaGrezza(chiavePonte, "ponte/msg-tessera-1.jpg")],
    });
    w.m.set(
      `chat_fatture_t:${L}`,
      JSON.stringify({
        lotto: L,
        creatoIl: new Date(T0).toISOString(),
        descrizione: "x",
        dataSeManca: "",
        firmaImpostazioni: "f",
      }),
    );
    aggiungiScheda(w, SCHEDA_PROVA);
    await CS.gestisciPOSTChat(
      richiesta("POST", { azione: "aggiungi-cliente", lotto: L, schedaId: SCHEDA_PROVA }),
      dip(w),
    );
    const r = await CS.gestisciPOSTChat(
      richiesta("POST", { azione: "cerca-chat", lotto: L, idRiga: SCHEDA_PROVA }),
      dip(w),
    );
    const corpo = await r.json();
    c("tesseraImmagine = 1 (la 1ª immagine mandata)", 1, corpo.riga?.chat?.tesseraImmagine);
    c("indirizzoImmagine = 2 (la 2ª immagine mandata)", 2, corpo.riga?.chat?.indirizzoImmagine);
    c(
      "fonti: 2 elementi, nello stesso ordine delle immagini mandate",
      2,
      corpo.riga?.chat?.fonti?.length,
    );
    c(
      "fonte 1 = ponte con la chiave del messaggio",
      true,
      corpo.riga?.chat?.fonti?.[0]?.tipo === "ponte" &&
        corpo.riga?.chat?.fonti?.[0]?.chiave === idPonte,
    );
    c(
      "fonte 2 = manychat con l'URL",
      true,
      corpo.riga?.chat?.fonti?.[1]?.tipo === "manychat" &&
        corpo.riga?.chat?.fonti?.[1]?.chiave === URL_MANYCHAT,
    );

    gruppo(
      "DALLA CHAT · T11.1 · GET ?miniatura=tessera firma con FIRMA_LETTURA_S (300s), stesso bucket del ponte",
    );
    {
      const rm = await CS.gestisciGETChat(
        richiesta("GET", undefined, `?lotto=${L}&miniatura=tessera&idRiga=${SCHEDA_PROVA}`),
        dip(w),
      );
      const corpoM = await rm.json();
      c(
        "miniatura tessera: risponde con un indirizzo",
        true,
        typeof corpoM[SCHEDA_PROVA] === "string",
      );
      c(
        "firmata con 300s (FIRMA_LETTURA_S, non 60: correzione del revisore su PIANO v3)",
        FIRMA_LETTURA_S_ATTESA,
        w.reg.firmePonte.at(-1)?.secondi,
      );
      c(
        "firmata sul percorso vero del ponte (stesso percorso, stesso bucket di /api/crm/ponte-media)",
        "ponte/msg-tessera-1.jpg",
        w.reg.firmePonte.at(-1)?.percorso,
      );
    }

    gruppo(
      "DALLA CHAT · T11.1 · GET ?miniatura=indirizzo (fonte ManyChat, niente percorso Storage) → richiesta_non_valida",
    );
    {
      const rm = await CS.gestisciGETChat(
        richiesta("GET", undefined, `?lotto=${L}&miniatura=indirizzo&idRiga=${SCHEDA_PROVA}`),
        dip(w),
      );
      c("status 400", 400, rm.status);
      const corpoM = await rm.json();
      c(
        "codice richiesta_non_valida, messaggio onesto (non un buco silenzioso)",
        true,
        corpoM.ok === false && corpoM.codice === "richiesta_non_valida" && !!corpoM.messaggio,
      );
    }
  }

  gruppo(
    "DALLA CHAT · T11.1 · un campo letto da TESTO (nessuna immagine) → nessuna miniatura, non un errore nella lettura",
  );
  {
    const w = mondo({
      risposteAi: () => ({
        testo: JSON.stringify({
          tessere: [{ nome: "Mario", cognome: "Rossi", codiceFiscale: CF_PROVA, incerti: [] }],
          indirizzi: [],
        }),
        fine: "stop",
      }),
    });
    w.m.set(
      `chat_fatture_t:${L}`,
      JSON.stringify({
        lotto: L,
        creatoIl: new Date(T0).toISOString(),
        descrizione: "x",
        dataSeManca: "",
        firmaImpostazioni: "f",
      }),
    );
    aggiungiScheda(w, SCHEDA_PROVA);
    await CS.gestisciPOSTChat(
      richiesta("POST", { azione: "aggiungi-cliente", lotto: L, schedaId: SCHEDA_PROVA }),
      dip(w),
    );
    const r = await CS.gestisciPOSTChat(
      richiesta("POST", { azione: "cerca-chat", lotto: L, idRiga: SCHEDA_PROVA }),
      dip(w),
    );
    const corpo = await r.json();
    c("CF trovato (letto da testo, nessuna immagine mandata)", true, !!corpo.riga?.chat?.tessera);
    c(
      "tesseraImmagine assente: non è un buco, è la verità",
      undefined,
      corpo.riga?.chat?.tesseraImmagine,
    );
    c("fonti assente (nessuna immagine mandata)", undefined, corpo.riga?.chat?.fonti);

    const rm = await CS.gestisciGETChat(
      richiesta("GET", undefined, `?lotto=${L}&miniatura=tessera&idRiga=${SCHEDA_PROVA}`),
      dip(w),
    );
    c(
      "GET miniatura=tessera senza provenienza → richiesta_non_valida (non una miniatura finta)",
      400,
      rm.status,
    );
  }

  gruppo(
    "DALLA CHAT · T11.1 · un indice dichiarato dall'AI fuori dal pacchetto mandato si scarta (non si inventa un'origine)",
  );
  {
    const w = mondo({
      // Una sola immagine mandata, ma l'AI dichiara «immagine: 99»: non esiste nel pacchetto.
      risposteAi: () => ({
        testo: JSON.stringify({
          tessere: [
            { nome: "Mario", cognome: "Rossi", codiceFiscale: CF_PROVA, immagine: 99, incerti: [] },
          ],
          indirizzi: [],
        }),
        fine: "stop",
      }),
      raccoltaMessaggi: [msgGrezzo("msg-x", "2026-11-01T10:00:00.000Z", "", { mediaType: "foto" })],
      raccoltaMedia: [mediaGrezza("bw:33312345678:msg-x", "ponte/msg-x.jpg")],
    });
    w.m.set(
      `chat_fatture_t:${L}`,
      JSON.stringify({
        lotto: L,
        creatoIl: new Date(T0).toISOString(),
        descrizione: "x",
        dataSeManca: "",
        firmaImpostazioni: "f",
      }),
    );
    aggiungiScheda(w, SCHEDA_PROVA);
    await CS.gestisciPOSTChat(
      richiesta("POST", { azione: "aggiungi-cliente", lotto: L, schedaId: SCHEDA_PROVA }),
      dip(w),
    );
    const r = await CS.gestisciPOSTChat(
      richiesta("POST", { azione: "cerca-chat", lotto: L, idRiga: SCHEDA_PROVA }),
      dip(w),
    );
    const corpo = await r.json();
    c("CF trovato comunque", true, !!corpo.riga?.chat?.tessera);
    c(
      "indice fuori dal pacchetto (99) → tesseraImmagine assente, non 99",
      undefined,
      corpo.riga?.chat?.tesseraImmagine,
    );
  }

  gruppo(
    "DALLA CHAT · T11.1 · la costante usata è davvero FIRMA_LETTURA_S del ponte (300s), non una propria",
  );
  {
    const MT = await impacchetta(radice, "src/crm/ponte/media-tipi.ts");
    c("FIRMA_LETTURA_S vale 300", 300, MT.FIRMA_LETTURA_S);
  }
}
