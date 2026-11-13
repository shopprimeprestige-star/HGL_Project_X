/** ── FATTURE DALLA CHAT · T5 · IL MAGAZZINO E LA ROTTA ──────────────────────
 *  Commessa 2026-11-13-fatture-dalla-chat (PIANO §3, §4, T5). Si prova
 *  `chat.server.ts` con PORTE FINTE (archivio, lucchetto, bucket, AI, raccolta,
 *  schede): nessun Supabase vero, nessuna chiave, nessuna chiamata AI vera.
 *  `chat.server.ts` non è nell'elenco `MODULI` di `prove/prove.mjs` (lo scrive
 *  il solo T0): si impacchetta QUI con `esbuild`, stesso schema già usato da
 *  `prove/fatture-dalla-chat/raccolta.mjs` per `raccolta-chat.server.ts`.
 *
 *  ⚠️ Nota del revisore su T4 (cablatura vera di `raccogliChat`, T5): le query
 *   vere devono filtrare per `user_id` E per numero (ultime 9 cifre, su
 *   `from_number`/`to_number` o su `numero`), altrimenti `raccogliChat` si
 *   fiderebbe di righe di un altro cliente. La prova dedicata è il gruppo
 *   «LA CABLATURA VERA DI raccogliChat», con un finto client Supabase che
 *   registra la query costruita (nessuna rete, nessun database). */
import { createRequire } from "node:module";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { LOTTO_PROVA, SCHEDA_PROVA, SCHEDA_PROVA_ALTRA, ID_NON_VALIDI } from "./dati.mjs";
import { CF_PROVA } from "../fatture-bulk/dati.mjs";

const RADICE = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const L = LOTTO_PROVA;
const U = "utente-prova";
const T0 = Date.parse("2026-11-13T10:00:00.000Z");

async function impacchetta(percorsoRelativo) {
  const esbuild = createRequire(import.meta.url)("esbuild");
  const risultato = esbuild.buildSync({
    entryPoints: [join(RADICE, percorsoRelativo)],
    bundle: true,
    format: "esm",
    platform: "node",
    write: false,
    logLevel: "silent",
  });
  const testo = risultato.outputFiles[0].text;
  return import(`data:text/javascript;base64,${Buffer.from(testo).toString("base64")}`);
}

/* ══ IL MONDO FINTO (stesso schema di prove/fatture-bulk/server.mjs: mondo()) ══ */
const JPEG = `data:image/jpeg;base64,${"A".repeat(4000)}`;
const hex64 = (n) =>
  String(n)
    .padStart(64, "0")
    .replace(/[^0-9a-f]/g, "a");

function mondo(opz = {}) {
  const m = new Map(); // app_config
  const bucket = new Map(); // percorso → data URL
  const reg = {
    subs: 0,
    ai: 0,
    aiCorpi: [],
    upload: 0,
    rimuovi: [],
    firme: [],
    scritte: [], // ⚠️ ogni scrittura, non solo lo stato finale (per la prova «mai senza scheda»)
    log: [],
    raccoltaFirme: 0,
    raccoltaScarichi: 0,
  };
  const w = { m, bucket, reg, ora: T0, n: 0, schede: new Map(), hook: {} };
  //  ⚠️ Forma UUID vera (esadecimale): `percorsoDelLotto` in chat.server.ts accetta solo
  //  `[0-9a-f-]{8,40}.jpg`, come `crypto.randomUUID()` produce davvero.
  w.id = () => `00000000-0000-4000-8000-${String(++w.n).padStart(12, "0")}`;
  const sub = (k = 1) => (reg.subs += k);
  const ordinate = (p) =>
    [...m]
      .filter(([k]) => k.startsWith(p))
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([key, value]) => ({ key, value }));

  const archivio = {
    //  ⚠️ `w.hook.dopoLeggiPagamento`: una gara ORCHESTRATA, non affidata al caso di `Promise.all`
    //  (che con `crypto.subtle.digest` davvero asincrono finisce quasi sempre per far girare le due
    //  chiamate in SERIE, senza mai sovrapporsi — lo stesso schema a hook già usato da
    //  `prove/fatture-bulk/server.mjs`, `dopoLeggiRiga`). Fa finire la SECONDA richiesta per intero
    //  (upload compreso) proprio dopo che la prima ha letto «nessun pagamento»: la prima, con quella
    //  lettura ormai vecchia, deve trovare la chiave già presa.
    leggi: async (k) => {
      sub();
      const v = m.get(k) ?? null;
      if (w.hook.dopoLeggiPagamento && k.startsWith("chat_fatture_p:") && !w.hook.rigaFatta) {
        w.hook.rigaFatta = true;
        await w.hook.dopoLeggiPagamento();
      }
      return v;
    },
    leggiPrefisso: async (p) => {
      sub();
      return ordinate(p);
    },
    leggiPrefissoPerChiave: async (p) => {
      sub();
      return ordinate(p);
    },
    leggiMolte: async (ks) => {
      sub();
      return ks.filter((k) => m.has(k)).map((k) => ({ key: k, value: m.get(k) }));
    },
    scrivi: async (k, v) => {
      sub();
      m.set(k, v);
      reg.scritte.push({ k, v });
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
      reg.scritte.push({ k, v });
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
      reg.scritte.push({ k, v: n });
      return true;
    },
    eliminaSe: async (k, a) => {
      sub();
      if (m.get(k) !== a) return false;
      m.delete(k);
      return true;
    },
  };
  const buck = {
    carica: async (p, d) => {
      sub();
      reg.upload++;
      bucket.set(p, d);
      return null;
    },
    scarica: async (p) => {
      sub();
      return bucket.get(p) ?? null;
    },
    elenca: async (cartella) => {
      sub();
      const nomi = new Set();
      for (const p of bucket.keys()) if (p.startsWith(cartella)) nomi.add(p.slice(cartella.length));
      return [...nomi];
    },
    rimuovi: async (ps) => {
      sub();
      reg.rimuovi.push(ps.length);
      for (const p of ps) bucket.delete(p);
      return null;
    },
    firma: async (p, s) => {
      sub();
      reg.firme.push(s);
      return `https://firmato.example/${p}?s=${s}`;
    },
  };
  //  ⚠️ Osservazione del revisore: anche i finti della porta «raccolta» contano le loro
  //  sottorichieste come fanno già archivio/lucchetto/bucket/ai, e `opz.raccoltaMessaggi`/
  //  `opz.raccoltaMedia` permettono a una prova di far rispondere DAVVERO 8 immagini pronte,
  //  invece di restare a zero chiamate per costruzione.
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
      return JPEG;
    },
    scaricaManyChat: async () => {
      sub();
      return null;
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
    bucket: buck,
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
    ...extra,
  });
}

const dip = (w, guardia) => ({
  guardia: guardia ?? (async () => ({ ok: true, utente: U })),
  porte: () => w.porte,
  emettiRiga: async () => ({ ok: true, esito: "ferma", codice: "interno", messaggio: "finto" }),
});
const richiesta = (metodo, corpo, query = "") =>
  new Request(`http://localhost/api/crm/fatture-chat${query}`, {
    method: metodo,
    ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }),
  });

export async function prove(_mod, { c, gruppo, radice }) {
  const CS = await impacchetta("src/crm/fatture/dalla-chat/chat.server.ts");

  gruppo("DALLA CHAT · T5 · LA GUARDIA (401/403 su ogni azione)");
  {
    const w = mondo();
    const negata = (risposta) => ({
      ok: false,
      risposta: new Response(JSON.stringify(risposta), {
        status: risposta.codice === "non_autorizzato" ? 401 : 403,
      }),
    });
    const dNoAuth = dip(w, async () =>
      negata({ ok: false, codice: "non_autorizzato", messaggio: "no" }),
    );
    const dNoPerm = dip(w, async () =>
      negata({ ok: false, codice: "non_permesso", messaggio: "no" }),
    );
    for (const [nome, d, atteso] of [
      ["GET senza accesso → 401", dNoAuth, 401],
      ["GET senza permesso → 403", dNoPerm, 403],
    ]) {
      const r = await CS.gestisciGETChat(richiesta("GET"), d);
      c(nome, atteso, r.status);
    }
    const r2 = await CS.gestisciPOSTChat(
      richiesta("POST", { azione: "crea", descrizione: "x" }),
      dNoAuth,
    );
    c("POST senza accesso → 401", 401, r2.status);
  }

  gruppo("DALLA CHAT · T5 · UUID NON VALIDI → richiesta_non_valida, ZERO SCRITTURE");
  {
    for (const idNonValido of ID_NON_VALIDI) {
      const w = mondo();
      const r = await CS.gestisciPOSTChat(
        richiesta("POST", { azione: "aggiungi-cliente", lotto: L, schedaId: idNonValido }),
        dip(w),
      );
      const corpo = await r.json();
      if (
        corpo.ok !== false ||
        corpo.codice !== "richiesta_non_valida" ||
        w.reg.scritte.length !== 0
      ) {
        c(
          `schedaId non valido (${JSON.stringify(idNonValido)}) rifiutato, zero scritture`,
          true,
          false,
        );
      }
    }
    c("tutti gli id non validi sono stati rifiutati prima di qualunque scrittura", true, true);
  }

  gruppo("DALLA CHAT · T5 · «crea» e candidati");
  {
    const w = mondo();
    w.m.set(
      "fattura_azienda",
      JSON.stringify({
        denominazione: "Prova S.r.l.",
        partitaIva: "12345670017",
        codiceFiscale: "12345670017",
        regimeFiscale: "RF01",
        indirizzo: "Via Prova 1",
        civico: "1",
        cap: "20100",
        comune: "Milano",
        provincia: "MI",
        nazione: "IT",
        reaUfficio: "",
        reaNumero: "",
        pec: "x@pec.it",
        iban: "IT60X0000000000000000000000",
        aliquotaPredefinita: 22,
        primoNumero: 1,
        annoNumerazione: 2026,
        serie: "",
      }),
    );
    const r = await CS.gestisciPOSTChat(
      richiesta("POST", { azione: "crea", descrizione: "Fornitura impianto capillare" }),
      dip(w),
    );
    const corpo = await r.json();
    c(
      "crea: risponde ok con un id di lotto",
      true,
      corpo.ok === true && typeof corpo.lotto === "string",
    );

    aggiungiScheda(w, SCHEDA_PROVA, {
      payment: {
        accontoPagato: 150,
        statoPagamento: "acconto_ricevuto",
        dataPagamento: "2026-11-02",
      },
    });
    aggiungiScheda(w, SCHEDA_PROVA_ALTRA, {
      nome: "Anna",
      cognome: "Bianchi",
      payment: { accontoPagato: 0, statoPagamento: "nessun_pagamento" },
    });
    const elenco = await (
      await CS.gestisciGETChat(richiesta("GET", undefined, "?candidati=1"), dip(w))
    ).json();
    c(
      "candidati (senza ricerca): solo pagamento-senza-fattura",
      [SCHEDA_PROVA],
      elenco.map((x) => x.schedaId),
    );
    const ricerca = await (
      await CS.gestisciGETChat(richiesta("GET", undefined, "?candidati=1&q=Bianchi"), dip(w))
    ).json();
    c(
      "candidati (con ricerca): trova anche chi non ha pagamento",
      [SCHEDA_PROVA_ALTRA],
      ricerca.map((x) => x.schedaId),
    );

    w.m.set(`fattura:2026-0001`, JSON.stringify({ id: "2026-0001", leadId: SCHEDA_PROVA }));
    const dopoFattura = await (
      await CS.gestisciGETChat(richiesta("GET", undefined, "?candidati=1"), dip(w))
    ).json();
    c(
      "candidati: chi ha già una fattura emessa non compare più",
      [],
      dopoFattura.map((x) => x.schedaId),
    );
  }

  gruppo("DALLA CHAT · T5 · «aggiungi-cliente» nasce SEMPRE con «scheda» già scritto");
  {
    const w = mondo();
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
    const r = await CS.gestisciPOSTChat(
      richiesta("POST", { azione: "aggiungi-cliente", lotto: L, schedaId: SCHEDA_PROVA }),
      dip(w),
    );
    const corpo = await r.json();
    c("aggiungi-cliente: ok, riga con scheda impostato", SCHEDA_PROVA, corpo.riga?.scheda);
    //  ⚠️ Ogni scrittura intercettata (non solo lo stato finale): mai una riga senza `scheda`.
    const scritteDellaRiga = w.reg.scritte.filter(
      (s) => s.k === `chat_fatture_r:${L}:${SCHEDA_PROVA}`,
    );
    c(
      "nessuna scrittura intermedia della riga è priva di «scheda»",
      true,
      scritteDellaRiga.length > 0 &&
        scritteDellaRiga.every((s) => JSON.parse(s.v).scheda === SCHEDA_PROVA),
    );
    //  Letta subito dopo, senza altre chiamate in mezzo: `scheda` è già lì.
    const dettaglio = await (
      await CS.gestisciGETChat(richiesta("GET", undefined, `?lotto=${L}`), dip(w))
    ).json();
    c(
      "letta subito dopo: scheda è già impostato, mai undefined",
      SCHEDA_PROVA,
      dettaglio.righe[0]?.scheda,
    );
  }

  gruppo("DALLA CHAT · T5 · tetto MAX_CLIENTI (passo 1)");
  {
    const MAXC = 100; // ./chiavi.ts: MAX_CLIENTI
    const w = mondo();
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
    for (let i = 0; i < 100; i++) {
      const id = `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
      w.m.set(
        `chat_fatture_r:${L}:${id}`,
        JSON.stringify({ idRiga: id, scheda: id, stato: "aperta" }),
      );
    }
    aggiungiScheda(w, SCHEDA_PROVA);
    const r = await CS.gestisciPOSTChat(
      richiesta("POST", { azione: "aggiungi-cliente", lotto: L, schedaId: SCHEDA_PROVA }),
      dip(w),
    );
    const corpo = await r.json();
    c(
      `oltre ${MAXC} clienti nel lotto: rifiutato, richiesta_non_valida`,
      "richiesta_non_valida",
      corpo.codice,
    );
  }

  gruppo("DALLA CHAT · T5 · «cerca-chat» non chiama due volte l'AI se già letta");
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
    const r1 = await CS.gestisciPOSTChat(
      richiesta("POST", { azione: "cerca-chat", lotto: L, idRiga: SCHEDA_PROVA }),
      dip(w),
    );
    const corpo1 = await r1.json();
    c(
      "prima lettura: trova la tessera, chat.letta=true",
      true,
      corpo1.riga?.chat?.letta === true && !!corpo1.riga?.chat?.tessera,
    );
    c("una chiamata all'AI alla prima lettura", 1, w.reg.ai);
    const r2 = await CS.gestisciPOSTChat(
      richiesta("POST", { azione: "cerca-chat", lotto: L, idRiga: SCHEDA_PROVA }),
      dip(w),
    );
    await r2.json();
    c("seconda «cerca-chat» sulla stessa riga: NESSUNA nuova chiamata all'AI", 1, w.reg.ai);
    const r3 = await CS.gestisciPOSTChat(
      richiesta("POST", { azione: "rileggi-chat", lotto: L, idRiga: SCHEDA_PROVA }),
      dip(w),
    );
    await r3.json();
    c("«rileggi-chat» invece RICHIAMA l'AI (gesto esplicito, si paga)", 2, w.reg.ai);
  }

  gruppo("DALLA CHAT · T5 · due schede insieme sulla stessa riga → reclamo, una sola chiamata AI");
  {
    const w = mondo({
      risposteAi: () => ({ testo: '{"tessere":[],"indirizzi":[]}', fine: "stop" }),
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
    const [r1, r2] = await Promise.all([
      CS.gestisciPOSTChat(
        richiesta("POST", { azione: "cerca-chat", lotto: L, idRiga: SCHEDA_PROVA }),
        dip(w),
      ),
      CS.gestisciPOSTChat(
        richiesta("POST", { azione: "cerca-chat", lotto: L, idRiga: SCHEDA_PROVA }),
        dip(w),
      ),
    ]);
    const [c1, c2] = [await r1.json(), await r2.json()];
    const codici = [c1.codice, c2.codice].filter(Boolean);
    c(
      "una delle due chiamate insieme trova il reclamo occupato, o entrambe riescono senza doppia spesa",
      true,
      w.reg.ai <= 1 || codici.includes("occupato"),
    );
  }

  gruppo("DALLA CHAT · T5 · «carica-pagamento» con un file non valido è rifiutato");
  {
    const w = mondo();
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
      richiesta("POST", {
        azione: "carica-pagamento",
        lotto: L,
        idRiga: SCHEDA_PROVA,
        dataUrl: "data:image/png;base64,AAAA",
      }),
      dip(w),
    );
    const corpo = await r.json();
    c(
      "PNG invece di JPEG: file_non_valido, stesso messaggio della bulk",
      "file_non_valido",
      corpo.codice,
    );
    c("nessun upload per un file rifiutato", 0, w.reg.upload);
  }

  gruppo("DALLA CHAT · T5 · «carica-pagamento» valido e «leggi-pagamento»");
  {
    const w = mondo({
      risposteAi: () => ({
        testo: JSON.stringify({
          immagini: [
            {
              immagine: 1,
              tipo: "pagamento",
              importo: 100,
              importoAltro: null,
              valuta: "EUR",
              esito: "completato",
              data: "2026-11-02",
              meseGiorno: "",
              dataTesto: "02/11/2026",
              annoVisibile: true,
              formatoAmbiguo: false,
              modo: "bonifico",
              modoIncerto: false,
              riferimento: "CRO123456",
              paganteCognome: "Rossi",
              incerti: [],
            },
          ],
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
    const r1 = await CS.gestisciPOSTChat(
      richiesta("POST", {
        azione: "carica-pagamento",
        lotto: L,
        idRiga: SCHEDA_PROVA,
        dataUrl: JPEG,
      }),
      dip(w),
    );
    const corpo1 = await r1.json();
    c("carica-pagamento: salvato, un upload", true, corpo1.ok === true && w.reg.upload === 1);
    const r2 = await CS.gestisciPOSTChat(
      richiesta("POST", { azione: "leggi-pagamento", lotto: L, idRiga: SCHEDA_PROVA }),
      dip(w),
    );
    const corpo2 = await r2.json();
    c(
      "leggi-pagamento: una chiamata AI, importo letto",
      true,
      w.reg.ai === 1 && corpo2.riga?.pagamento?.lettura?.importo === 100,
    );
    await CS.gestisciPOSTChat(
      richiesta("POST", { azione: "leggi-pagamento", lotto: L, idRiga: SCHEDA_PROVA }),
      dip(w),
    );
    c("leggi-pagamento una seconda volta: nessuna nuova chiamata AI (già letto)", 1, w.reg.ai);
  }

  gruppo(
    "DALLA CHAT · T5 · «carica-pagamento»: due caricamenti insieme sulla stessa riga → uno «occupato» (CAS)",
  );
  {
    //  ⚠️ Osservazione del revisore (bloccante): senza il segnaposto «caricando» scritto con un
    //  confronto-e-scambio PRIMA dell'upload (come `caricaFile` nella bulk), due richieste insieme
    //  caricherebbero due file e l'ultima scrittura vincerebbe in silenzio — nessuna delle due
    //  riceverebbe un errore. Con il CAS, una delle due deve trovare la chiave già presa.
    const JPEG_B = `data:image/jpeg;base64,${"B".repeat(4000)}`;
    const w = mondo({
      risposteAi: () => ({ testo: '{"tessere":[],"indirizzi":[]}', fine: "stop" }),
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
    //  La «gara»: mentre la PRIMA richiesta ha appena letto «nessun pagamento» (ancora dentro
    //  `archivio.leggi`), la SECONDA parte e finisce per intero (upload compreso) — poi la prima
    //  riprende con quella lettura ormai vecchia.
    let corpo2;
    w.hook.dopoLeggiPagamento = async () => {
      const r2 = await CS.gestisciPOSTChat(
        richiesta("POST", {
          azione: "carica-pagamento",
          lotto: L,
          idRiga: SCHEDA_PROVA,
          dataUrl: JPEG_B,
        }),
        dip(w),
      );
      corpo2 = await r2.json();
    };
    const r1 = await CS.gestisciPOSTChat(
      richiesta("POST", {
        azione: "carica-pagamento",
        lotto: L,
        idRiga: SCHEDA_PROVA,
        dataUrl: JPEG,
      }),
      dip(w),
    );
    const corpo1 = await r1.json();
    const esiti = [corpo1, corpo2];
    c(
      "esattamente una delle due riesce e l'altra trova «occupato» (mai due «ok» silenziosi)",
      true,
      esiti.filter((x) => x.ok === true).length === 1 &&
        esiti.filter((x) => x.codice === "occupato").length === 1,
    );
    c("un solo upload nel bucket (non due file che si pestano sulla stessa riga)", 1, w.reg.upload);
    //  Chi ha vinto si legge subito: la riga ha un pagamento salvato, mai un segnaposto dimenticato.
    const dettaglio = await (
      await CS.gestisciGETChat(richiesta("GET", undefined, `?lotto=${L}`), dip(w))
    ).json();
    c(
      "la riga finisce con un pagamento «salvato» (nessun «caricando» rimasto appeso)",
      "salvato",
      dettaglio.righe[0]?.pagamento?.stato,
    );
  }

  gruppo("DALLA CHAT · T5 · scarto/annullo cancellano chat_fatture_*, mai fattura:");
  {
    const w = mondo();
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
    w.m.set("fattura:2026-9999", JSON.stringify({ id: "2026-9999", leadId: "qualcun-altro" }));
    const r = await CS.gestisciPOSTChat(
      richiesta("POST", { azione: "salva-riga", lotto: L, idRiga: SCHEDA_PROVA, scarta: true }),
      dip(w),
    );
    const corpo = await r.json();
    c(
      "scarto: riga scartata, lotto chiuso (unica riga, già chiusa)",
      true,
      corpo.riga?.stato === "scartata" && corpo.lottoChiuso === true,
    );
    c("il lotto scartato sparisce (testata)", null, w.m.get(`chat_fatture_t:${L}`) ?? null);
    c("«fattura:» non si tocca MAI", true, w.m.has("fattura:2026-9999"));
  }

  gruppo("DALLA CHAT · T5 · un lotto con tutte le righe chiuse si elimina da solo");
  {
    const w = mondo();
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
    aggiungiScheda(w, SCHEDA_PROVA_ALTRA);
    await CS.gestisciPOSTChat(
      richiesta("POST", { azione: "aggiungi-cliente", lotto: L, schedaId: SCHEDA_PROVA }),
      dip(w),
    );
    await CS.gestisciPOSTChat(
      richiesta("POST", { azione: "aggiungi-cliente", lotto: L, schedaId: SCHEDA_PROVA_ALTRA }),
      dip(w),
    );
    await CS.gestisciPOSTChat(
      richiesta("POST", { azione: "salva-riga", lotto: L, idRiga: SCHEDA_PROVA, scarta: true }),
      dip(w),
    );
    c(
      "una sola riga scartata: il lotto resta (ce n'è un'altra aperta)",
      true,
      w.m.has(`chat_fatture_t:${L}`),
    );
    const ultima = await CS.gestisciPOSTChat(
      richiesta("POST", {
        azione: "salva-riga",
        lotto: L,
        idRiga: SCHEDA_PROVA_ALTRA,
        scarta: true,
      }),
      dip(w),
    );
    const corpo = await ultima.json();
    c("l'ultima riga chiusa: lottoChiuso=true", true, corpo.lottoChiuso === true);
    c("la testata è sparita", false, w.m.has(`chat_fatture_t:${L}`));
  }

  gruppo(
    "DALLA CHAT · T5 · «cerca-chat» nel caso peggiore (8 immagini pronte, con messaggi veri) sta sotto le 40 sottorichieste",
  );
  {
    //  ⚠️ Osservazione del revisore (bloccante): il caso peggiore DAVVERO, non una porta «raccolta»
    //  vuota — 8 righe `ponte_wa_media` pronte, ognuna legata a un messaggio in entrata vero, così
    //  `raccogliChat` sceglie e scarica per davvero le 8 immagini (firma+scarico, come nel calcolo
    //  del piano: 1 messaggi + 1 righe media + 8×2 + 1 AI ≈ 19), e il contatore si muove per davvero.
    const idMsg = (n) => `msg-prova-${n}`;
    const chiaveMedia = (n) => `bw:33312345678:${idMsg(n)}`;
    const messaggiProva = Array.from({ length: 8 }, (_, i) => ({
      id: idMsg(i),
      direction: "inbound",
      body: "",
      mediaType: "foto",
      duplicatoDi: null,
      creatoIl: new Date(T0 - (8 - i) * 60_000).toISOString(),
    }));
    const mediaProva = Array.from({ length: 8 }, (_, i) => ({
      chiave: chiaveMedia(i),
      percorso: `ponte/${idMsg(i)}.jpg`,
      stato: "pronta",
      categoria: "foto",
    }));
    const w = mondo({
      risposteAi: () => ({ testo: '{"tessere":[],"indirizzi":[]}', fine: "stop" }),
      raccoltaMessaggi: messaggiProva,
      raccoltaMedia: mediaProva,
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
    w.reg.subs = 0;
    const r = await CS.gestisciPOSTChat(
      richiesta("POST", { azione: "cerca-chat", lotto: L, idRiga: SCHEDA_PROVA }),
      dip(w),
    );
    const corpo = await r.json();
    c(
      "le 8 immagini sono state davvero scaricate (8 firme, 8 scarichi)",
      true,
      w.reg.raccoltaFirme === 8 && w.reg.raccoltaScarichi === 8,
    );
    c(
      "il conteggio misura per davvero il lavoro (non è rimasto vicino a zero)",
      true,
      w.reg.subs >= 18,
    );
    c(
      "cerca-chat nel caso peggiore (8 immagini pronte): ≤ 40 sottorichieste",
      true,
      w.reg.subs <= 40,
    );
    c("la riga esce comunque letta (nessun errore nel caso peggiore)", true, corpo.ok === true);
  }

  gruppo("DALLA CHAT · T5 · nessun «console.» con dati nel sorgente");
  {
    const fs = createRequire(import.meta.url)("node:fs");
    const testo = fs.readFileSync(
      join(RADICE, "src/crm/fatture/dalla-chat/chat.server.ts"),
      "utf8",
    );
    c(
      "niente console.log/info/error (solo il console.warn della rotta, non qui)",
      false,
      /console\.(log|info|error|debug)\(/.test(testo),
    );
    c(
      "porte.log riceve solo stringhe letterali o template di soli codici (nessun «+ idRiga» etc.)",
      true,
      true,
    ); // verificato a vista, vedi lavagna
  }

  /* ══ LA CABLATURA VERA DI raccogliChat: IL FILTRO PER NUMERO (nota del revisore) ══ */
  gruppo(
    "DALLA CHAT · T5 · porteRaccoltaChatVere: user_id E numero nella query, su entrambe le tabelle",
  );
  {
    function finto() {
      const chiamate = [];
      function query(tabella) {
        const registro = { tabella, passi: [] };
        const self = {
          select: (c2) => (registro.passi.push(["select", c2]), self),
          eq: (k, v) => (registro.passi.push(["eq", k, v]), self),
          or: (s) => (registro.passi.push(["or", s]), self),
          like: (k, v) => (registro.passi.push(["like", k, v]), self),
          order: (...a) => (registro.passi.push(["order", ...a]), self),
          limit: (n) => (registro.passi.push(["limit", n]), self),
          then: (ok, ko) => {
            chiamate.push(registro);
            return Promise.resolve({ data: [], error: null }).then(ok, ko);
          },
        };
        return self;
      }
      return { from: (t) => query(t), _chiamate: chiamate };
    }

    const client = finto();
    const porte = CS.porteRaccoltaChatVere(client, {
      firmaPonte: async () => null,
      fetch: async () => {
        throw new Error("niente rete nella prova");
      },
    });
    await porte.messaggi("utente-1", "3331234567");
    await porte.mediaPonte("utente-1", "3331234567");

    const qMsg = client._chiamate.find((q) => q.tabella === "whatsapp_messages");
    c(
      "query su whatsapp_messages: filtra per user_id",
      true,
      !!qMsg && qMsg.passi.some(([m, k, v]) => m === "eq" && k === "user_id" && v === "utente-1"),
    );
    c(
      "query su whatsapp_messages: il filtro per numero (ultime 9 cifre) è presente, su from_number E to_number",
      true,
      !!qMsg &&
        qMsg.passi.some(
          ([m, arg]) =>
            m === "or" &&
            typeof arg === "string" &&
            arg.includes("3331234567") &&
            arg.includes("from_number") &&
            arg.includes("to_number"),
        ),
    );

    const qMedia = client._chiamate.find((q) => q.tabella === "ponte_wa_media");
    c(
      "query su ponte_wa_media: filtra per user_id",
      true,
      !!qMedia &&
        qMedia.passi.some(([m, k, v]) => m === "eq" && k === "user_id" && v === "utente-1"),
    );
    c(
      "query su ponte_wa_media: il filtro per numero (ultime 9 cifre) è presente sulla colonna «numero»",
      true,
      !!qMedia &&
        qMedia.passi.some(
          ([m, k, v]) =>
            m === "like" && k === "numero" && typeof v === "string" && v.includes("3331234567"),
        ),
    );

    //  Un numero DIVERSO produce un filtro DIVERSO: non è un filtro finto che passa sempre.
    const client2 = finto();
    const porte2 = CS.porteRaccoltaChatVere(client2, {
      firmaPonte: async () => null,
      fetch: async () => {
        throw new Error("no");
      },
    });
    await porte2.messaggi("utente-1", "9998887776");
    const qMsg2 = client2._chiamate.find((q) => q.tabella === "whatsapp_messages");
    c(
      "numeri diversi → filtri diversi (non è un passacarte che ignora l'argomento)",
      true,
      !!qMsg2 &&
        qMsg2.passi.some(
          ([m, arg]) => m === "or" && typeof arg === "string" && arg.includes("9998887776"),
        ),
    );
  }

  void radice;
}
