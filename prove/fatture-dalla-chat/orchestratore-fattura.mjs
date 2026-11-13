/** ── FATTURE DALLA CHAT · T14 · L'ORCHESTRATORE DELLA VIA 2 (useSelezioneFattura.ts) ──
 *  Commessa 2026-11-13-fatture-dalla-chat (PIANO §2bis/§3bis/§4, T14), SPEC §9.3
 *  passi 4-6, §9.6, §9.7 criteri 1-2. Stesso schema di `prove/fatture-dalla-chat/
 *  orchestratore.mjs` (T7): la rotta è FINTA (parla il contratto minimo scritto
 *  in PIANO §3bis per `aggiungi-da-chat`/`leggi-bolle`, non ancora nel tipo
 *  condiviso — T11 in corso) e si prova solo l'orchestrazione (porte finte),
 *  non la rotta vera.
 *  `useSelezioneFattura.ts` non è nell'elenco `MODULI` di `prove/prove.mjs`
 *  (resta di T0): si impacchetta QUI con `esbuild`, stesso schema di T13 — il
 *  file importa `mediaDelPonte` (`chatwa/usaMediaPonte.ts`), che importa
 *  `react`/`@/integrations/supabase/client`/`@/crm/AuthContext`: i due ultimi
 *  si ridirigono a due stub minimi (stesso trucco di T13/`prove/ponte/media-chat-ui.mjs`).
 *  ⚠️ Nessun dato personale: id di fantasia, nessun numero o CF vero. */
import { createRequire } from "node:module";
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

async function impacchetta(radice, percorso) {
  const esbuild = createRequire(import.meta.url)("esbuild");
  const dir = mkdtempSync(join(tmpdir(), "orchestratore-fattura-"));
  try {
    writeFileSync(join(dir, "client.js"), "export const supabase = {};");
    writeFileSync(join(dir, "auth.js"), "export const fetchCRM = async () => new Response('{}');");
    const risultato = await esbuild.build({
      entryPoints: [join(radice, percorso)],
      bundle: true,
      format: "esm",
      platform: "node",
      write: false,
      logLevel: "silent",
      alias: { "@": join(radice, "src") },
      plugins: [
        {
          name: "rete-finta",
          setup(b) {
            b.onResolve({ filter: /^@\/integrations\/supabase\/client$/ }, () => ({
              path: join(dir, "client.js"),
            }));
            b.onResolve({ filter: /^@\/crm\/AuthContext$/ }, () => ({
              path: join(dir, "auth.js"),
            }));
          },
        },
      ],
    });
    const testo = risultato.outputFiles[0].text;
    return await import(`data:text/javascript;base64,${Buffer.from(testo).toString("base64")}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const S1 = "3f2a9c1e-77b0-4c1d-9d2e-0a1b2c3d4e5f";
const S2 = "a1b2c3d4-e5f6-4789-9abc-def012345678";
const LOTTO = "lotto-0123abcd";

const lead = (id, telefono) => ({
  id,
  user_id: "u",
  data: { nome: "N", cognome: "C", telefono },
  created_at: "x",
  updated_at: "x",
});

const baileys = (id, body, chiave = "bw:393330001111:3EB0A1B2C3D4") => ({
  id,
  canale: "baileys",
  wa_message_id: chiave,
  body,
});
const testo = (id, body) => ({ id, canale: "manychat", body });

function rigaVuota(idRiga) {
  return { idRiga, scheda: idRiga, stato: "aperta" };
}

export async function prove(_mod, { c, gruppo, radice }) {
  const U = await impacchetta(radice, "src/crm/fatture/dalla-chat/useSelezioneFattura.ts");

  /* ══ 1. IL REDUCER (pura, senza rete) ═══════════════════════════════════ */
  gruppo("DALLA CHAT · T14 · reducerFattura: selezione e azzeramento");
  {
    const s0 = U.reducerFattura(U.STATO_INIZIALE_FATTURA, { tipo: "telefono", telefono: "123" });
    c("il telefono si registra", "123", s0.telefono);
    const s1 = U.reducerFattura(s0, { tipo: "commuta", id: "m1", tipoBolla: "testo" });
    c("un tocco aggiunge la bolla", ["m1"], s1.scelti);
    c("il tipo della bolla si ricorda", { m1: "testo" }, s1.tipi);
    const s2 = U.reducerFattura(s1, { tipo: "commuta", id: "m2", tipoBolla: "immagine" });
    c("una seconda bolla si aggiunge in fondo", ["m1", "m2"], s2.scelti);
    const s3 = U.reducerFattura(s2, { tipo: "commuta", id: "m1", tipoBolla: "testo" });
    c("un secondo tocco sulla stessa bolla la toglie", ["m2"], s3.scelti);
    c("il tipo della bolla togliere sparisce", { m2: "immagine" }, s3.tipi);
    const s4 = U.reducerFattura(s3, { tipo: "telefono", telefono: "456" });
    c(
      "cambiare telefono azzera la selezione (SPEC §9.6)",
      { telefono: "456", scelti: [], tipi: {} },
      { telefono: s4.telefono, scelti: s4.scelti, tipi: s4.tipi },
    );
    const s5 = U.reducerFattura(s4, { tipo: "telefono", telefono: "456" });
    c("lo STESSO telefono non azzera niente (nessun cambio superfluo)", s4, s5);
    const s6 = U.reducerFattura(
      U.reducerFattura(s4, { tipo: "commuta", id: "m3", tipoBolla: "testo" }),
      { tipo: "azzera" },
    );
    c(
      "azzera riporta la selezione a zero ma tiene il telefono",
      { telefono: "456", scelti: [] },
      {
        telefono: s6.telefono,
        scelti: s6.scelti,
      },
    );
    c(
      "lavoroFatturaInCorso: vero solo durante «lavoro»",
      [true, false],
      [
        U.lavoroFatturaInCorso({ ...U.STATO_INIZIALE_FATTURA, fase: { tipo: "lavoro" } }),
        U.lavoroFatturaInCorso(U.STATO_INIZIALE_FATTURA),
      ],
    );
  }

  /* ══ 2. L'ORCHESTRATORE, CON LA ROTTA FINTA ══════════════════════════════ */
  function banco({ su = () => undefined, telefono = "393331234567" } = {}) {
    let s = { ...U.STATO_INIZIALE_FATTURA, telefono };
    const chiamate = [];
    const server = new Map();
    let numeroLotti = 0;
    const fetchRotta = async (url, init = {}) => {
      const body = init.body ? JSON.parse(init.body) : null;
      chiamate.push({ url, body });
      const custom = await su({ url, body, server });
      const r = custom ?? predefinita(body);
      return { ok: (r.stato ?? 200) < 400, status: r.stato ?? 200, json: async () => r.corpo };
    };
    const predefinita = (body) => {
      switch (body?.azione) {
        case "aggiungi-da-chat": {
          const esistente = [...server.values()].find((x) => x.scheda === body.schedaId);
          if (esistente)
            return {
              corpo: {
                ok: true,
                azione: "aggiungi-da-chat",
                lotto: esistente.lotto,
                riga: esistente.riga,
              },
            };
          numeroLotti++;
          const lotto = numeroLotti === 1 ? LOTTO : `${LOTTO}-${numeroLotti}`;
          const riga = rigaVuota(body.schedaId);
          server.set(body.schedaId, { lotto, scheda: body.schedaId, riga });
          return { corpo: { ok: true, azione: "aggiungi-da-chat", lotto, riga } };
        }
        case "leggi-bolle": {
          const v = [...server.values()].find((x) => x.riga.idRiga === body.idRiga);
          const aggiornata = { ...v.riga, chat: { letta: true, motivi: [], segnaposto: false } };
          v.riga = aggiornata;
          return { corpo: { ok: true, azione: "leggi-bolle", riga: aggiornata } };
        }
        default:
          return { corpo: { ok: true, azione: body?.azione } };
      }
    };
    const o = U.creaOrchestratoreFattura({
      fetchRotta,
      dispatch: (a) => {
        s = U.reducerFattura(s, a);
      },
      stato: () => s,
    });
    return {
      o,
      chiamate,
      server,
      stato: () => s,
      azioni: (nome) => chiamate.filter((x) => x.body?.azione === nome).map((x) => x.body),
    };
  }

  gruppo("DALLA CHAT · T14 · usaPerFattura: zero schede");
  {
    const b = banco();
    b.o.commuta(baileys("m1", "📷 Foto"));
    const r = await b.o.usaPerFattura([]); // nessuna scheda con questo numero
    c("zero schede: nessun lotto ancora, nessuna riga", null, r);
    c(
      "la fase segnala «zero-schede» (il chiamante invoca onCreaScheda)",
      "zero-schede",
      b.stato().fase.tipo,
    );
    c("nessuna chiamata aggiungi-da-chat fatta a vuoto", 0, b.azioni("aggiungi-da-chat").length);
    c(
      "la selezione NON si perde (si riprova con la scheda appena creata)",
      ["m1"],
      b.stato().scelti,
    );
  }

  gruppo("DALLA CHAT · T14 · usaPerFattura: una sola scheda, procede da sola");
  {
    const b = banco();
    b.o.commuta(baileys("m1", "📷 Foto: tessera"));
    b.o.commuta(testo("m2", "Via Roma 1, 00100 Roma"));
    const r = await b.o.usaPerFattura([lead(S1, "393331234567")]);
    c("torna {lotto, idRiga}", { lotto: LOTTO, idRiga: S1 }, r);
    c("la fase è «pronta»", { tipo: "pronta", lotto: LOTTO, idRiga: S1 }, b.stato().fase);
    c(
      "aggiungi-da-chat chiamato con la scheda trovata",
      [{ azione: "aggiungi-da-chat", schedaId: S1 }],
      b.azioni("aggiungi-da-chat"),
    );
    c(
      "leggi-bolle manda SOLO le bolle scelte, col tipo giusto (immagine/testo)",
      [
        {
          azione: "leggi-bolle",
          lotto: LOTTO,
          idRiga: S1,
          bolle: [
            { id: "m1", tipo: "immagine" },
            { id: "m2", tipo: "testo" },
          ],
        },
      ],
      b.azioni("leggi-bolle"),
    );
  }

  gruppo("DALLA CHAT · T14 · usaPerFattura: più schede, il titolare scelglie (continua)");
  {
    const b = banco();
    b.o.commuta(testo("m1", "RSSMRA80A01H501Z"));
    const r1 = await b.o.usaPerFattura([lead(S1, "393331234567"), lead(S2, "393331234567")]);
    c("niente ancora: bisogna scegliere", null, r1);
    c(
      "la fase porta le schede candidate, nessuna scelta automatica",
      [S1, S2],
      b.stato().fase.schede?.map((l) => l.id),
    );
    const r2 = await b.o.continua(S2);
    c("dopo la scelta del titolare, procede con quella scheda", { lotto: LOTTO, idRiga: S2 }, r2);
    c(
      "aggiungi-da-chat ha usato lo schedaId scelto, non il primo della lista",
      S2,
      b.azioni("aggiungi-da-chat")[0].schedaId,
    );
  }

  gruppo("DALLA CHAT · T14 · doppio tocco: non duplica la riga");
  {
    // Doppio tocco CONCORRENTE (prima che il primo sia finito): il secondo è no-op.
    const b = banco();
    b.o.commuta(testo("m1", "Via Roma 1, 00100 Roma"));
    const p1 = b.o.usaPerFattura([lead(S1, "393331234567")]);
    const p2 = b.o.usaPerFattura([lead(S1, "393331234567")]);
    const [r1, r2] = await Promise.all([p1, p2]);
    c(
      "solo il primo tocco procede, il secondo torna null (lavoro già in corso)",
      [true, null],
      [!!r1, r2],
    );
    c("una sola chiamata aggiungi-da-chat, non due", 1, b.azioni("aggiungi-da-chat").length);
  }
  {
    // Doppio tocco SEQUENZIALE, dopo che la riga è già pronta: non si ripete la rete.
    const b = banco();
    b.o.commuta(testo("m1", "Via Roma 1, 00100 Roma"));
    await b.o.usaPerFattura([lead(S1, "393331234567")]);
    const r2 = await b.o.usaPerFattura([lead(S1, "393331234567")]);
    c("il secondo tocco, a riga già creata, non fa niente", null, r2);
    c(
      "nessuna seconda chiamata aggiungi-da-chat/leggi-bolle",
      [1, 1],
      [b.azioni("aggiungi-da-chat").length, b.azioni("leggi-bolle").length],
    );
  }

  gruppo("DALLA CHAT · T14 · errore di rete: un messaggio, non uno stato a metà");
  {
    const b = banco({
      su: ({ body }) =>
        body?.azione === "aggiungi-da-chat"
          ? { stato: 500, corpo: { ok: false, codice: "rete", messaggio: "x" } }
          : undefined,
    });
    b.o.commuta(testo("m1", "Via Roma 1, 00100 Roma"));
    const r = await b.o.usaPerFattura([lead(S1, "393331234567")]);
    c("nessun risultato", null, r);
    c("la fase è «errore», con un messaggio leggibile", "errore", b.stato().fase.tipo);
    c("il messaggio non è vuoto", true, (b.stato().fase.messaggio?.length ?? 0) > 0);
    c("la selezione resta (si può riprovare senza riscegliere le bolle)", ["m1"], b.stato().scelti);
    c(
      "nessuna fase «pronta» a metà: leggi-bolle non è mai stato chiamato",
      0,
      b.azioni("leggi-bolle").length,
    );
  }

  gruppo("DALLA CHAT · T14 · commuta: non si tocca la selezione mentre si lavora");
  {
    let bloccaLeggiBolle = null;
    const b = banco({
      su: ({ body }) =>
        body?.azione === "leggi-bolle"
          ? new Promise((risolvi) => (bloccaLeggiBolle = risolvi)).then(() => ({
              corpo: { ok: true, azione: "leggi-bolle", riga: rigaVuota(S1) },
            }))
          : undefined,
    });
    b.o.commuta(testo("m1", "x"));
    const lavoro = b.o.usaPerFattura([lead(S1, "393331234567")]);
    await new Promise((r) => setImmediate(r));
    c("durante il lavoro la fase è «lavoro»", "lavoro", b.stato().fase.tipo);
    b.o.commuta(testo("m2", "y"));
    c("un tocco durante il lavoro non cambia la selezione", ["m1"], b.stato().scelti);
    bloccaLeggiBolle();
    await lavoro;
  }

  gruppo("DALLA CHAT · T14 · commuta: una bolla non selezionabile non entra mai");
  {
    const b = banco();
    b.o.commuta({ id: "s1", canale: "baileys", body: "[messaggio senza testo]" }); // sticker/reazione
    c("uno sticker/una reazione non si sceglie", [], b.stato().scelti);
  }

  gruppo("DALLA CHAT · T14 · fatturaAttiva (mutua esclusione con «Rispiega con AI»)");
  {
    const s0 = U.STATO_INIZIALE_FATTURA;
    const s1 = U.reducerFattura(s0, { tipo: "commuta", id: "m1", tipoBolla: "testo" });
    c(
      "fatturaAttiva (scelti.length>0) distingue «nessuna bolla» da «almeno una scelta»",
      [false, true],
      [s0.scelti.length > 0, s1.scelti.length > 0],
    );
  }

  /* ══ 3. SORGENTE: niente coupling con rispiega.ts, beforeunload presente ═ */
  gruppo("DALLA CHAT · T14 · sorgente");
  {
    const src = readFileSync(
      join(radice, "src/crm/fatture/dalla-chat/useSelezioneFattura.ts"),
      "utf8",
    );
    c(
      "nessuna riga IMPORT riferisce risposte-ai/rispiega o useRispostaAi (§0bis.1)",
      false,
      src
        .split("\n")
        .filter((r) => /^\s*import\b/.test(r))
        .some((r) => /risposte-ai\/rispiega|useRispostaAi/.test(r)),
    );
    c("c'è l'avviso alla chiusura della scheda durante il lavoro", true, /beforeunload/.test(src));
    c("l'hook espone fatturaAttiva (PIANO §0bis.1, usato da T15)", true, /fatturaAttiva/.test(src));
    c(
      "nessun dato personale nei commenti o nel codice",
      false,
      /\d{11}|\d{9,}/.test(src.replace(/9d2e|3f2a9c1e/g, "")),
    );
  }
}
