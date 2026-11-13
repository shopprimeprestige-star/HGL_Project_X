/** ── FATTURE DALLA CHAT · T4 · LA RACCOLTA DALLA CHAT ───────────────────────
 *  Commessa 2026-11-13-fatture-dalla-chat (PIANO §4, T4; SPEC §5, §6.7, §8).
 *  `raccogliChat(porte, userId, telefono)`: testo (300 msg/6000 caratteri),
 *  immagini (ponte «pronta»+ManyChat, fino a 8), segnaposto. PORTE SEMPRE
 *  FINTE: nessun Supabase vero, nessuna chiave, nessuna rete — la reale
 *  implementazione delle porte (Supabase, Storage, fetch) la scrive chi cablerà
 *  la rotta (T5), non questo file.
 *
 *  `raccolta-chat.server.ts` non è nell'elenco `MODULI` di `prove/prove.mjs`
 *  (lo scrive il solo T0): si impacchetta QUI con `esbuild`, stesso schema già
 *  usato da `prove/fatture-dalla-chat/lettura-chat.mjs`/`valuta-chat.mjs` per
 *  `prove/fatture-bulk/interfaccia.mjs` (`cambio-riga.ts`) — non una scorciatoia
 *  nuova. */
import { createRequire } from "node:module";
import { join } from "node:path";

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

/** Un messaggio grezzo (quello che la porta `messaggi` restituisce). */
const msg = (id, creatoIl, body, extra = {}) => ({
  id,
  direction: "inbound",
  body,
  mediaType: null,
  duplicatoDi: null,
  creatoIl,
  ...extra,
});

/** Una riga grezza di `ponte_wa_media` (quella che la porta `mediaPonte` restituisce). */
const mediaRow = (chiave, percorso, extra = {}) => ({
  chiave,
  percorso,
  stato: "pronta",
  categoria: "foto",
  ...extra,
});

/** Porte finte con un contatore di chiamate per contatore di sottorichieste (§3 del piano). */
function fintePorte({ messaggi = [], media = [], firme = {}, scarichi = {}, manychat = {} } = {}) {
  const chiamate = {
    messaggi: 0,
    mediaPonte: 0,
    firmaPonte: 0,
    scaricaPonte: 0,
    scaricaManyChat: 0,
  };
  const argomenti = { ultime9Messaggi: [], ultime9Media: [] };
  const porte = {
    async messaggi(userId, ultime9) {
      chiamate.messaggi++;
      argomenti.ultime9Messaggi.push(ultime9);
      return messaggi;
    },
    async mediaPonte(userId, ultime9) {
      chiamate.mediaPonte++;
      argomenti.ultime9Media.push(ultime9);
      return media;
    },
    async firmaPonte(percorso) {
      chiamate.firmaPonte++;
      return percorso in firme ? firme[percorso] : null;
    },
    async scaricaPonte(url) {
      chiamate.scaricaPonte++;
      return url in scarichi ? scarichi[url] : null;
    },
    async scaricaManyChat(url) {
      chiamate.scaricaManyChat++;
      return url in manychat ? manychat[url] : null;
    },
  };
  return { porte, chiamate, argomenti };
}

const TOTALE_CHIAMATE = (chiamate) => Object.values(chiamate).reduce((a, b) => a + b, 0);

export async function prove(mod, { c, gruppo, radice }) {
  const R = await impacchetta(radice, "src/crm/fatture/dalla-chat/raccolta-chat.server.ts");

  gruppo("DALLA CHAT · T4 · TESTO: FINO A 300 MESSAGGI, I PIÙ RECENTI");
  {
    const messaggi = [];
    for (let i = 0; i < 350; i++)
      messaggi.push(
        msg(`m${i}`, `2026-01-01T00:${String(i % 60).padStart(2, "0")}:00.000Z`, `m${i}`, {
          // Un timestamp strettamente crescente con i: niente collisioni fra i 350.
          creatoIl: new Date(Date.UTC(2026, 0, 1) + i * 1000).toISOString(),
        }),
      );
    const { porte } = fintePorte({ messaggi });
    const r = await R.raccogliChat(porte, "u1", "+393331234567");
    const atteso = Array.from({ length: 300 }, (_, k) => `m${k + 50}`).join("\n");
    c("tenuti solo i 300 messaggi più recenti, in ordine cronologico", atteso, r.testo);
  }

  gruppo("DALLA CHAT · T4 · TESTO: FINO A 6000 CARATTERI, TAGLIO PER MESSAGGIO INTERO");
  {
    const messaggi = Array.from({ length: 10 }, (_, i) =>
      msg(`m${i}`, undefined, String.fromCharCode(65 + i).repeat(1000), {
        creatoIl: new Date(Date.UTC(2026, 0, 1) + i * 1000).toISOString(),
      }),
    );
    const { porte } = fintePorte({ messaggi });
    const r = await R.raccogliChat(porte, "u1", "+393331234567");
    const atteso = [5, 6, 7, 8, 9].map((i) => String.fromCharCode(65 + i).repeat(1000)).join("\n");
    c("oltre 6000 caratteri: si tolgono i messaggi più VECCHI per intero", atteso, r.testo);
    c("il risultato resta sotto il tetto", true, r.testo.length <= 6000);
  }

  gruppo("DALLA CHAT · T4 · NUMERO CON O SENZA «+39»: STESSE ULTIME 9 CIFRE");
  {
    const messaggi = [msg("m1", undefined, "ciao", { creatoIl: "2026-01-01T00:00:00.000Z" })];
    const { porte, argomenti } = fintePorte({ messaggi });
    const r1 = await R.raccogliChat(porte, "u1", "+39 333 123 4567");
    const r2 = await R.raccogliChat(porte, "u1", "3331234567");
    c(
      "stesso risultato con o senza prefisso/spazi",
      true,
      JSON.stringify(r1) === JSON.stringify(r2),
    );
    c(
      "alla porta arrivano le stesse ultime 9 cifre",
      true,
      argomenti.ultime9Messaggi.every((n) => n === "331234567"),
    );
  }

  gruppo("DALLA CHAT · T4 · SOLO I MESSAGGI IN ENTRATA (mai quelli del titolare)");
  {
    const messaggi = [
      msg("in1", "2026-01-01T00:00:00.000Z", "testo del cliente"),
      {
        ...msg("out1", "2026-01-01T00:01:00.000Z", "OUTBOUND-SEGRETO"),
        direction: "outbound",
      },
    ];
    const { porte } = fintePorte({ messaggi });
    const r = await R.raccogliChat(porte, "u1", "+393331234567");
    c(
      "il testo del titolare non entra mai nella chat raccolta",
      false,
      r.testo.includes("OUTBOUND-SEGRETO"),
    );
    c("il testo del cliente resta", true, r.testo.includes("testo del cliente"));
  }

  gruppo("DALLA CHAT · T4 · I DOPPIONI DEL PONTE (duplicato_di) NON ENTRANO");
  {
    const messaggi = [
      msg("in1", "2026-01-01T00:00:00.000Z", "messaggio vero"),
      { ...msg("in2", "2026-01-01T00:01:00.000Z", "DOPPIONE"), duplicatoDi: "in1" },
    ];
    const { porte } = fintePorte({ messaggi });
    const r = await R.raccogliChat(porte, "u1", "+393331234567");
    c(
      "un messaggio marcato come doppione non entra nel testo",
      false,
      r.testo.includes("DOPPIONE"),
    );
  }

  gruppo("DALLA CHAT · T4 · IMMAGINI: 9 FOTO PRONTE → TENUTE LE 8 PIÙ RECENTI");
  {
    const messaggi = Array.from({ length: 9 }, (_, i) =>
      msg(`p${i}`, undefined, "Foto", {
        mediaType: "foto",
        creatoIl: new Date(Date.UTC(2026, 0, 1) + i * 1000).toISOString(),
      }),
    );
    const media = Array.from({ length: 9 }, (_, i) =>
      mediaRow(`bw:393331234567:p${i}`, `perc${i}`),
    );
    const firme = {};
    const scarichi = {};
    for (let i = 0; i < 9; i++) {
      firme[`perc${i}`] = `https://firmata/${i}`;
      scarichi[`https://firmata/${i}`] = `data:image/jpeg;base64,IMG${i}`;
    }
    const { porte, chiamate } = fintePorte({ messaggi, media, firme, scarichi });
    const r = await R.raccogliChat(porte, "u1", "+393331234567");
    const atteso = Array.from({ length: 8 }, (_, k) => `data:image/jpeg;base64,IMG${k + 1}`);
    c(
      "tenute le 8 foto più recenti, in ordine cronologico (la più vecchia, p0, è scartata)",
      atteso,
      r.immagini,
    );
    c(
      "ogni foto scelta costa esattamente firma+scarico (8×2), mai di più",
      [8, 8],
      [chiamate.firmaPonte, chiamate.scaricaPonte],
    );
  }

  gruppo("DALLA CHAT · T4 · IMMAGINI: SOLO stato=PRONTA E categoria=FOTO");
  {
    const messaggi = [
      msg("ok1", undefined, "Foto", { mediaType: "foto", creatoIl: "2026-01-01T00:00:03.000Z" }),
      msg("car1", undefined, "Foto", { mediaType: "foto", creatoIl: "2026-01-01T00:00:02.000Z" }),
      msg("lib1", undefined, "Foto", { mediaType: "foto", creatoIl: "2026-01-01T00:00:01.000Z" }),
      msg("doc1", undefined, "Documento", {
        mediaType: "documento",
        creatoIl: "2026-01-01T00:00:00.000Z",
      }),
    ];
    const media = [
      mediaRow("bw:393331234567:ok1", "percok1"),
      mediaRow("bw:393331234567:car1", "perccar1", { stato: "in_caricamento" }),
      mediaRow("bw:393331234567:lib1", "perclib1", { stato: "liberato" }),
      mediaRow("bw:393331234567:doc1", "percdoc1", { categoria: "documento" }),
    ];
    const firme = { percok1: "https://firmata/ok1" };
    const scarichi = { "https://firmata/ok1": "data:image/jpeg;base64,OK1" };
    const { porte, chiamate } = fintePorte({ messaggi, media, firme, scarichi });
    const r = await R.raccogliChat(porte, "u1", "+393331234567");
    c(
      "in_caricamento, liberato e documento escluse: resta solo quella pronta/foto",
      ["data:image/jpeg;base64,OK1"],
      r.immagini,
    );
    c(
      "per le escluse non si firma né si scarica niente (nessuno sforzo sprecato)",
      [1, 1],
      [chiamate.firmaPonte, chiamate.scaricaPonte],
    );
  }

  gruppo("DALLA CHAT · T4 · IMMAGINI MANYCHAT (link diretto)");
  {
    const urlBuona =
      "https://manybot-files.s3.eu-central-1.amazonaws.com/pagina1/wa/2026/11/10/foto.jpg";
    const urlCattiva = "https://evil.example.com/wa/2026/11/10/foto.jpg";
    const messaggi = [
      msg("mc1", "2026-01-01T00:00:00.000Z", urlBuona),
      msg("mc2", "2026-01-01T00:00:01.000Z", urlCattiva),
    ];
    const manychat = { [urlBuona]: "data:image/jpeg;base64,MANYCHAT" };
    const { porte, chiamate } = fintePorte({ messaggi, manychat });
    const r = await R.raccogliChat(porte, "u1", "+393331234567");
    c(
      "il link ManyChat riconosciuto diventa un'immagine scaricata al volo",
      ["data:image/jpeg;base64,MANYCHAT"],
      r.immagini,
    );
    c(
      "scaricato con la porta dedicata, mai con un upload (quella porta non esiste nemmeno)",
      1,
      chiamate.scaricaManyChat,
    );
    c(
      "il link con un host non ammesso non passa classificaTesto: niente scarico per lui",
      1,
      chiamate.scaricaManyChat,
    );
    c(
      "il link scartato resta semplice testo (nessun crash, nessuna immagine fantasma)",
      true,
      r.testo.includes(urlCattiva) && !r.immagini.includes(urlCattiva),
    );
  }

  gruppo("DALLA CHAT · T4 · SEGNAPOSTO (foto non ancora scaricate dal ponte)");
  {
    const senzaPronta = [
      msg("f1", undefined, "Foto", { mediaType: "foto", creatoIl: "2026-01-01T00:00:00.000Z" }),
    ];
    const r1 = await R.raccogliChat(
      fintePorte({ messaggi: senzaPronta }).porte,
      "u1",
      "+393331234567",
    );
    c("messaggio-foto senza nessuna riga pronta → segnaposto vero", true, r1.segnaposto);

    const conPronta = [
      msg("f2", undefined, "Foto", { mediaType: "foto", creatoIl: "2026-01-01T00:00:00.000Z" }),
    ];
    const media2 = [mediaRow("bw:393331234567:f2", "percf2")];
    const firme2 = { percf2: "https://firmata/f2" };
    const scarichi2 = { "https://firmata/f2": "data:image/jpeg;base64,F2" };
    const r2 = await R.raccogliChat(
      fintePorte({ messaggi: conPronta, media: media2, firme: firme2, scarichi: scarichi2 }).porte,
      "u1",
      "+393331234567",
    );
    c("la stessa foto, ma già pronta → nessun segnaposto", false, r2.segnaposto);

    const niente = [
      msg("t1", undefined, "solo testo, nessuna foto", { creatoIl: "2026-01-01T00:00:00.000Z" }),
    ];
    const r3 = await R.raccogliChat(fintePorte({ messaggi: niente }).porte, "u1", "+393331234567");
    c("nessun messaggio-foto → nessun segnaposto", false, r3.segnaposto);
  }

  gruppo("DALLA CHAT · T4 · NUMERO TROPPO CORTO O ASSENTE: NIENTE DA LEGGERE, NESSUNA CHIAMATA");
  {
    const { porte, chiamate } = fintePorte({
      messaggi: [msg("x", undefined, "non deve arrivare qui")],
    });
    const r = await R.raccogliChat(porte, "u1", "123");
    c(
      // ⚠️ T11.1 (provenienza delle miniature): `RaccoltaChat` guadagna `fonti` (array parallelo a
      // `immagini`, qui vuoto come lei) — tocco minimo a questa prova, non al comportamento.
      "risultato vuoto, senza indovinare niente",
      { testo: "", immagini: [], fonti: [], segnaposto: false },
      r,
    );
    c(
      "nessuna porta chiamata: zero sottorichieste spese per un numero inservibile",
      0,
      TOTALE_CHIAMATE(chiamate),
    );
  }

  gruppo("DALLA CHAT · T4 · SOTTORICHIESTE: IL CASO PEGGIORE RESTA SOTTO IL TETTO DI 40 (SPEC §3)");
  {
    const messaggi = [];
    for (let i = 0; i < 300; i++)
      messaggi.push(
        msg(`m${i}`, undefined, `riga ${i}`, {
          creatoIl: new Date(Date.UTC(2026, 0, 1) + i * 1000).toISOString(),
        }),
      );
    for (let i = 0; i < 8; i++)
      messaggi.push(
        msg(`p${i}`, undefined, "Foto", {
          mediaType: "foto",
          creatoIl: new Date(Date.UTC(2026, 0, 2) + i * 1000).toISOString(),
        }),
      );
    const media = Array.from({ length: 8 }, (_, i) =>
      mediaRow(`bw:393331234567:p${i}`, `perc${i}`),
    );
    const firme = {};
    const scarichi = {};
    for (let i = 0; i < 8; i++) {
      firme[`perc${i}`] = `https://firmata/${i}`;
      scarichi[`https://firmata/${i}`] = `data:image/jpeg;base64,IMG${i}`;
    }
    const { porte, chiamate } = fintePorte({ messaggi, media, firme, scarichi });
    await R.raccogliChat(porte, "u1", "+393331234567");
    const totale = TOTALE_CHIAMATE(chiamate);
    c(
      "8 immagini pronte + il testo: 1 (messaggi) + 1 (righe media) + 8×2 (firma+scarico) = 18",
      18,
      totale,
    );
    c("ben sotto il tetto delle 40 sottorichieste per azione", true, totale <= 40);
  }

  gruppo("DALLA CHAT · T4 · SOLO CODICE PURO, NESSUN DATO PERSONALE NEI LOG");
  const { readFileSync } = await import("node:fs");
  const sorgente = readFileSync(
    join(radice, "src/crm/fatture/dalla-chat/raccolta-chat.server.ts"),
    "utf8",
  );
  c(
    "niente console., niente rete vera, niente Supabase, niente chiave",
    [false, false, false, false],
    [
      /console\./.test(sorgente),
      /\bfetch\(/.test(sorgente),
      /supabase|process\.env|@\/integrations/.test(sorgente),
      /sk-or-/.test(sorgente),
    ],
  );
  c(
    "riusa classificaTesto della chat esistente (non una terza copia del riconoscimento dei link)",
    true,
    /from "\.\.\/\.\.\/chatwa\/media"/.test(sorgente),
  );
  c(
    "riusa le costanti già scritte in chiavi.ts (non una quarta copia dei tetti 300/6000/8)",
    true,
    /from "\.\/chiavi"/.test(sorgente),
  );
}
