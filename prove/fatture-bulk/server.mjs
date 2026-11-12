/** ── FATTURE BULK · T9 · LA ROTTA E IL MAGAZZINO (senza emissione) ─────────
 *  Si prova `bulk.server.ts` con PORTE FINTE (archivio, lucchetti, bucket, AI, orologio): niente rete,
 *  niente database, niente OpenRouter. Ogni porta CONTA le sottorichieste che farebbe sul serio (una
 *  `leggiMolte` di 120 chiavi = 3, a gruppi di 50), così il tetto di 40 per azione si prova davvero.
 *  Dati di fantasia. La prova sul database vero è T15; quella con l'AI vera è T14. */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CF_PROVA } from "./dati.mjs";

const RADICE = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const T0 = Date.parse("2026-11-12T10:00:00.000Z");
const GIORNO = 86_400_000;
const L = "lotto-0123abcd";
const U = "utente-uno";

const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const hex64 = (n) =>
  String(n)
    .padStart(64, "0")
    .replace(/[^0-9a-f]/g, "a");
const JPEG = `data:image/jpeg;base64,${"A".repeat(4000)}`;
const PNG = `data:image/png;base64,${"A".repeat(4000)}`;
const kF = (lotto, i) => `bulk_fatture_f:${lotto}:${String(i).padStart(4, "0")}`;
const kR = (lotto, id) => `bulk_fatture_r:${lotto}:${id}`;
const kT = (lotto) => `bulk_fatture_t:${lotto}`;
const kC = (lotto, g) => `bulk_fatture_c:${lotto}:${g}`;

export const AZIENDA = {
  denominazione: "ESEMPIO CAPELLI S.R.L.",
  partitaIva: "12345670017",
  codiceFiscale: "12345670017",
  regimeFiscale: "RF01",
  indirizzo: "Via dei Ciliegi",
  civico: "5",
  cap: "20100",
  comune: "Milano",
  provincia: "MI",
  nazione: "IT",
  reaUfficio: "",
  reaNumero: "",
  pec: "esempio@pec.example",
  iban: "IT60X0542811101000000123456",
  aliquotaPredefinita: 22,
  primoNumero: 1,
  annoNumerazione: 2026,
  serie: "",
};

/** Una risposta dell'AI per i tipi indicati (dati di fantasia). */
function jsonAi(tipi) {
  const v = {
    indirizzo: {
      tipo: "indirizzo",
      indirizzo: "Via dei Tigli 4",
      cap: "20100",
      comune: "Milano",
      provincia: "MI",
      telefono: "3331234567",
      nome: "Lucia",
      cognome: "Verdi",
      indirizzoDiSpedizione: false,
      incerti: [],
    },
    tessera: {
      tipo: "tessera",
      nome: "Lucia",
      cognome: "Verdi",
      codiceFiscale: CF_PROVA,
      incerti: [],
    },
    pagamento: {
      tipo: "pagamento",
      importo: 104,
      importoAltro: null,
      valuta: "EUR",
      esito: "completato",
      data: "2026-10-01",
      meseGiorno: "",
      dataTesto: "01/10/2026",
      annoVisibile: true,
      formatoAmbiguo: false,
      modo: "pos",
      modoIncerto: false,
      riferimento: "",
      paganteCognome: "Verdi",
      incerti: [],
    },
    altro: { tipo: "altro", incerti: [] },
  };
  return JSON.stringify({ immagini: tipi.map((t, i) => ({ immagine: i + 1, ...v[t] })) });
}

/* ═══ IL MONDO FINTO ═══════════════════════════════════════════════════════ */
export function mondo(opz = {}) {
  const m = new Map(); // app_config
  const bucket = new Map(); // percorso → data URL
  const reg = {
    subs: 0,
    ai: 0,
    aiImmagini: [],
    aiTimeout: [],
    upload: 0,
    rimuovi: [],
    prefissiCancellati: [],
    eliminate: [],
    log: [],
    firme: [],
    scritte: [],
  };
  const w = {
    m,
    bucket,
    reg,
    ora: T0,
    hook: {},
    rotte: { rimuoviFallisce: 0, caricaFallisce: false, scriviFallisceSu: null },
    n: 0,
  };
  w.risposteAi = opz.risposteAi ?? null; // (immagini, chiamata) => EsitoAI
  w.id = () => uuid(++w.n);
  const sub = (k = 1) => {
    reg.subs += k;
  };
  const ordinate = (p) =>
    [...m]
      .filter(([k]) => k.startsWith(p))
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([key, value]) => ({ key, value }));

  const archivio = {
    leggi: async (k) => {
      sub();
      const v = m.get(k) ?? null;
      if (w.hook.dopoLeggiRiga && k.startsWith("bulk_fatture_r:") && !w.hook.rigaFatta) {
        w.hook.rigaFatta = true;
        await w.hook.dopoLeggiRiga(); // una gara: qualcuno scrive la riga DOPO che l'abbiamo letta
      }
      return v;
    },
    leggiPrefisso: async (p) => {
      sub();
      return ordinate(p);
    },
    leggiPrefissoPerChiave: async (p) => {
      const righe = ordinate(p);
      sub(Math.max(1, Math.ceil(righe.length / 1000)));
      if (w.hook.dopoPrimoAccesso && p === "bulk_fatture_t:" && !w.hook.primoFatto) {
        w.hook.primoFatto = true;
        await w.hook.dopoPrimoAccesso();
      }
      if (w.hook.dopoPrefisso && p.startsWith("bulk_fatture_f:") && !w.hook.fatto) {
        w.hook.fatto = true;
        await w.hook.dopoPrefisso();
      }
      return righe;
    },
    leggiMolte: async (ks) => {
      sub(Math.ceil(ks.length / 50));
      return ks.filter((k) => m.has(k)).map((k) => ({ key: k, value: m.get(k) }));
    },
    scrivi: async (k, v) => {
      sub();
      if (w.rotte.scriviFallisceSu && w.rotte.scriviFallisceSu.test(k)) return "errore finto";
      m.set(k, v);
      reg.scritte.push(k);
      return null;
    },
    elimina: async (k) => {
      sub();
      reg.eliminate.push(k);
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
      if (!p.startsWith("bulk_fatture_") || p.length <= 13) return "prefisso non ammesso";
      reg.prefissiCancellati.push(p);
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
  const buck = {
    carica: async (p, d) => {
      sub();
      reg.upload++;
      if (w.rotte.caricaFallisce) return "upload finto fallito";
      if (bucket.has(p)) return "esiste";
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
      for (const p of bucket.keys())
        if (p.startsWith(cartella)) nomi.add(p.slice(cartella.length).split("/")[0]);
      const elenco = [...nomi];
      if (w.hook.dopoPrimoAccesso && cartella === `${U}/bulk/` && !w.hook.primoFatto) {
        w.hook.primoFatto = true;
        await w.hook.dopoPrimoAccesso();
      }
      return elenco;
    },
    rimuovi: async (ps) => {
      sub();
      reg.rimuovi.push(ps.length);
      if (w.rotte.rimuoviFallisce > 0) {
        w.rotte.rimuoviFallisce--;
        return "rimozione finta fallita";
      }
      for (const p of ps) bucket.delete(p);
      return null;
    },
    firma: async (p, s) => {
      sub();
      reg.firme.push(s);
      return `https://firmato.example/${p}?s=${s}`;
    },
  };
  const ai = async (immagini, timeoutMs) => {
    sub();
    reg.ai++;
    reg.aiImmagini.push(immagini.length);
    reg.aiTimeout.push(timeoutMs);
    if (w.risposteAi) return w.risposteAi(immagini, reg.ai);
    return {
      testo: jsonAi(immagini.map((_, i) => ["indirizzo", "tessera", "pagamento"][i % 3])),
      fine: "stop",
    };
  };
  w.porte = {
    archivio,
    lucchetto,
    bucket: buck,
    ai,
    adesso: () => w.ora,
    id: w.id,
    log: (c) => reg.log.push(c),
    utente: U,
  };
  w.azzera = () => {
    reg.subs = 0;
  };
  m.set("fattura_azienda", JSON.stringify(AZIENDA));
  return w;
}

/** Un lotto di `n` file già caricati (stato «salvato») con il loro file nel bucket. */
export function semina(
  w,
  {
    lotto = L,
    n = 3,
    creatoIl = new Date(T0).toISOString(),
    tipi = null,
    stato = "salvato",
    conLettura = false,
  } = {},
) {
  w.m.set(
    kT(lotto),
    JSON.stringify({
      lotto,
      creatoIl,
      descrizione: "prova",
      dataSeManca: "",
      firmaImpostazioni: "x",
    }),
  );
  for (let i = 0; i < n; i++) {
    const percorso = `${U}/bulk/${lotto}/${uuid(9000 + i + (lotto === L ? 0 : 500))}.jpg`;
    w.bucket.set(percorso, JPEG);
    const tipo = tipi ? tipi[i] : "";
    const f = { indice: i, stato, impronta: hex64(i + 1), tipo, percorso };
    if (conLettura) f.lettura = JSON.parse(jsonAi([tipo || "altro"])).immagini[0];
    w.m.set(kF(lotto, i), JSON.stringify(f));
  }
}

export const dip = (w, guardia) => ({
  guardia: guardia ?? (async () => ({ ok: true, utente: U })),
  porte: () => w.porte,
  emettiRiga: async (_p, r) => ({
    ok: true,
    esito: "ferma",
    codice: "interno",
    messaggio: `finto ${r.idRiga}`,
  }),
});
export const richiesta = (metodo, corpo, query = "") =>
  new Request(`http://localhost/api/crm/fatture-bulk${query}`, {
    method: metodo,
    ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }),
  });

export async function prove(mod, { c, gruppo }) {
  const B = mod["fatture/bulk/bulk.server"];
  const post = async (w, corpo, d) => {
    const r = await B.gestisciPOST(richiesta("POST", corpo), d ?? dip(w));
    return { stato: r.status, corpo: await r.json(), intest: r.headers };
  };
  const get = async (w, query, d) => {
    const r = await B.gestisciGET(richiesta("GET", undefined, query), d ?? dip(w));
    return { stato: r.status, corpo: await r.json(), intest: r.headers };
  };
  const conta = async (w, f) => {
    w.azzera();
    const r = await f();
    return { r, subs: w.reg.subs };
  };
  const sotto = (n) => n > 0 && n <= B.LIMITE_SOTTORICHIESTE;

  /* ═════ 1. GUARDIA ═════ */
  gruppo("BULK · T9 · SENZA SESSIONE 401, SENZA PERMESSO 403: TUTTE LE AZIONI E LE MINIATURE");
  {
    const w = mondo();
    semina(w);
    const azioni = [
      { azione: "crea", descrizione: "x" },
      { azione: "file", lotto: L, indice: 0, impronta: hex64(1), dataUrl: JPEG },
      { azione: "leggi-gruppo", lotto: L, gruppo: 0 },
      { azione: "rileggi", lotto: L, indici: [0] },
      { azione: "salva-riga", lotto: L, idRiga: "0000-0001-0002", scarta: true },
      { azione: "emetti-riga", lotto: L, idRiga: "0000-0001-0002", emittente: "scheda-123456" },
      { azione: "prendi-controllo", lotto: L, emittente: "scheda-123456" },
      { azione: "annulla", lotto: L },
      { azione: "pulisci" },
    ];
    const no = (status) => async () => ({
      ok: false,
      risposta: new Response(
        JSON.stringify({ ok: false, error: status === 401 ? "auth" : "permesso" }),
        { status },
      ),
    });
    for (const [status, nome] of [
      [401, "senza sessione"],
      [403, "senza permesso"],
    ]) {
      const esiti = [];
      for (const a of azioni) esiti.push((await post(w, a, dip(w, no(status)))).stato);
      for (const q of ["", `?lotto=${L}`, `?lotto=${L}&url=0000`])
        esiti.push((await get(w, q, dip(w, no(status)))).stato);
      c(
        `${nome}: tutte le 9 azioni e i 3 GET (anche le miniature) → ${status}`,
        Array(12).fill(status),
        esiti,
      );
    }
    c("e nessuna porta è stata toccata", [0, 0, 0], [w.reg.subs, w.reg.ai, w.reg.upload]);
    const src = readFileSync(join(RADICE, "src/routes/api.crm.fatture-bulk.ts"), "utf8");
    c(
      "la rotta vera usa guardiaCRM con il permesso «pagamenti», senza CORS e con il titolare obbligatorio",
      [true, false, true],
      [
        /guardiaCRM\(request, \{\}, "pagamenti"\)/.test(src),
        /Access-Control/i.test(src),
        /adminUserId/.test(src),
      ],
    );
  }

  /* ═════ 2. CREA ═════ */
  gruppo("BULK · T9 · CREA");
  {
    const w = mondo();
    const { r, subs } = await conta(w, () =>
      post(w, { azione: "crea", descrizione: "Novembre", dataSeManca: "2026-10-31" }),
    );
    const t = JSON.parse(w.m.get(kT(r.corpo.lotto)) ?? "{}");
    c(
      "crea → un lotto con testata, firma delle impostazioni e data di riserva",
      [200, true, "Novembre", "2026-10-31", true],
      [
        r.stato,
        /^[a-z0-9-]{4,40}$/.test(r.corpo.lotto),
        t.descrizione,
        t.dataSeManca,
        t.firmaImpostazioni.length > 5,
      ],
    );
    c("poche sottorichieste", true, sotto(subs));
    c(
      "un `tipo` diverso da «unica» → rifiutato, niente scritto",
      [400, "richiesta_non_valida", 1],
      await (async () => {
        const n = w.m.size;
        const x = await post(w, { azione: "crea", descrizione: "x", tipo: "acconto" });
        return [x.stato, x.corpo.codice, w.m.size - n + 1];
      })(),
    );
    c(
      "`tipo: unica` va bene",
      200,
      (await post(w, { azione: "crea", descrizione: "x", tipo: "unica" })).stato,
    );
    c(
      "data di riserva impossibile → rifiutata",
      400,
      (await post(w, { azione: "crea", descrizione: "x", dataSeManca: "2026-02-31" })).stato,
    );
    const w2 = mondo();
    w2.m.set("fattura_azienda", JSON.stringify({ ...AZIENDA, aliquotaPredefinita: 0 }));
    const z = await post(w2, { azione: "crea", descrizione: "x" });
    c(
      "aliquota zero (controllaLotto blocca) → rifiutato con la ragione, nessun lotto",
      [400, true, 1],
      [
        z.stato,
        /bollo/i.test(z.corpo.messaggio),
        [...w2.m.keys()].filter((k) => k.startsWith("bulk_fatture_t:")).length + 1,
      ],
    );
  }

  /* ═════ 3. FILE ═════ */
  gruppo("BULK · T9 · FILE: IDEMPOTENTE, PERCORSO SENZA NOMI, «CARICANDO» CON SCADENZA");
  {
    const w = mondo();
    w.m.set(
      kT(L),
      JSON.stringify({
        lotto: L,
        creatoIl: new Date(T0).toISOString(),
        descrizione: "Mario Rossi",
        dataSeManca: "",
        firmaImpostazioni: "x",
      }),
    );
    const corpo = (i, imp = i + 1, dataUrl = JPEG) => ({
      azione: "file",
      lotto: L,
      indice: i,
      impronta: hex64(imp),
      dataUrl,
    });
    const { r, subs } = await conta(w, () => post(w, corpo(0)));
    const f0 = JSON.parse(w.m.get(kF(L, 0)));
    c(
      "un file → salvato, stato «salvato», percorso <utente>/bulk/<lotto>/<uuid>.jpg",
      [200, "salvato", "salvato", true],
      [
        r.stato,
        r.corpo.esito,
        f0.stato,
        new RegExp(`^${U}/bulk/${L}/[0-9a-f-]{36}\\.jpg$`).test(f0.percorso),
      ],
    );
    c(
      "nel bucket c'è quel file e nessun nome di persona nel percorso",
      [1, false],
      [w.bucket.size, [...w.bucket.keys()].some((p) => /mario|rossi/i.test(p))],
    );
    c(
      "senza scadenza dopo il salvataggio e poche sottorichieste",
      [false, true],
      ["scadeIl" in f0, sotto(subs)],
    );
    c(
      "lo stesso file di nuovo → «gia», nessun secondo upload",
      ["gia", 1],
      [(await post(w, corpo(0))).corpo.esito, w.reg.upload],
    );

    const due = await Promise.all([post(w, corpo(1)), post(w, corpo(1))]);
    c(
      "due richieste insieme per lo stesso file → UN solo upload; l'altra «occupato»",
      [1 + 1, ["occupato", "salvato"]],
      [w.reg.upload, due.map((x) => x.corpo.esito ?? x.corpo.codice).sort()],
    );

    w.rotte.caricaFallisce = true;
    const rotto = await post(w, corpo(2));
    c(
      "upload fallito → errore e la chiave del file è rimossa (si può riprovare)",
      [500, false],
      [rotto.stato, w.m.has(kF(L, 2))],
    );
    w.rotte.caricaFallisce = false;
    c("riprovando, salva", "salvato", (await post(w, corpo(2))).corpo.esito);

    //  «caricando» scaduto: il Worker è morto fra la chiave e l'upload.
    const vecchio = `${U}/bulk/${L}/${uuid(777)}.jpg`;
    w.bucket.set(vecchio, JPEG);
    w.m.set(
      kF(L, 3),
      JSON.stringify({
        indice: 3,
        stato: "caricando",
        impronta: hex64(4),
        tipo: "",
        percorso: vecchio,
        scadeIl: new Date(T0 - 1000).toISOString(),
      }),
    );
    const ripreso = await post(w, corpo(3));
    const f3 = JSON.parse(w.m.get(kF(L, 3)));
    c(
      "«caricando» SCADUTO → il file si ritenta, non resta «gia» per sempre; il vecchio oggetto è tolto",
      ["salvato", "salvato", false, true],
      [
        ripreso.corpo.esito,
        f3.stato,
        w.bucket.has(vecchio),
        f3.percorso !== vecchio && w.bucket.has(f3.percorso),
      ],
    );
    w.m.set(
      kF(L, 4),
      JSON.stringify({
        indice: 4,
        stato: "caricando",
        impronta: hex64(5),
        tipo: "",
        percorso: `${U}/bulk/${L}/${uuid(778)}.jpg`,
        scadeIl: new Date(T0 + 60_000).toISOString(),
      }),
    );
    const vivo = await post(w, corpo(4));
    c(
      "«caricando» ancora VIVO → «occupato» (riprova), nessun upload in più",
      [409, "occupato"],
      [vivo.stato, vivo.corpo.codice],
    );

    c(
      "il 601° file (indice 600) → rifiutato con un messaggio chiaro",
      [413, "troppi_file"],
      await (async () => {
        const x = await post(w, corpo(600));
        return [x.stato, x.corpo.codice];
      })(),
    );
    c("l'ultimo ammesso (599) passa", "salvato", (await post(w, corpo(599, 700))).corpo.esito);
    c(
      "un PNG, un CAP... cioè un file che non è JPEG → rifiutato",
      [400, "file_non_valido"],
      await (async () => {
        const x = await post(w, corpo(10, 20, PNG));
        return [x.stato, x.corpo.codice];
      })(),
    );
    c(
      "un file troppo piccolo → rifiutato",
      400,
      (await post(w, corpo(10, 20, "data:image/jpeg;base64,AAAA"))).stato,
    );
    c(
      "impronta non valida / lotto non valido / lotto che non esiste",
      [400, 400, 404],
      [
        (await post(w, { ...corpo(10), impronta: "xyz" })).stato,
        (await post(w, { ...corpo(10), lotto: "../x" })).stato,
        (await post(w, { ...corpo(10), lotto: "lotto-nonesiste" })).stato,
      ],
    );

    //  Stessi screenshot già letti: nessun upload, nessuna lettura.
    const w2 = mondo();
    semina(w2, { n: 1, tipi: ["pagamento"], stato: "letto", conLettura: true });
    const copia = await post(w2, {
      azione: "file",
      lotto: L,
      indice: 5,
      impronta: hex64(1),
      dataUrl: JPEG,
    });
    const f5 = JSON.parse(w2.m.get(kF(L, 5)));
    c(
      "stessa impronta di un file già letto → «copia» (copiaDi), tipo e lettura dell'originale, nessun upload",
      ["copia", 0, 0, "pagamento", true, false],
      [
        copia.corpo.esito,
        copia.corpo.copiaDi,
        w2.reg.upload,
        f5.tipo,
        !!f5.lettura,
        "percorso" in f5,
      ],
    );
  }

  /* ═════ 4. LEGGI-GRUPPO ═════ */
  gruppo("BULK · T9 · LEGGI-GRUPPO: UNA SOLA CHIAMATA, UN SOLO TENTATIVO, RECLAMO");
  {
    const w = mondo();
    semina(w);
    const { r, subs } = await conta(w, () =>
      post(w, { azione: "leggi-gruppo", lotto: L, gruppo: 0 }),
    );
    c(
      "legge il gruppo: 3 file «letto» coi loro tipi, UNA chiamata AI con 3 immagini e scadenza 55 s",
      [200, ["letto", "letto", "letto"], ["indirizzo", "tessera", "pagamento"], 1, [3], [55000]],
      [
        r.stato,
        r.corpo.file.map((f) => f.stato),
        r.corpo.file.map((f) => f.tipo),
        w.reg.ai,
        w.reg.aiImmagini,
        w.reg.aiTimeout,
      ],
    );
    c(
      "la risposta non porta i percorsi del bucket",
      false,
      JSON.stringify(r.corpo).includes("/bulk/"),
    );
    c(
      "sotto le 40 sottorichieste e il reclamo è stato rilasciato",
      [true, false],
      [sotto(subs), w.m.has(kC(L, 0))],
    );
    const seconda = await post(w, { azione: "leggi-gruppo", lotto: L, gruppo: 0 });
    c(
      "leggi-gruppo una SECONDA volta → nessuna nuova chiamata AI",
      [200, 1],
      [seconda.stato, w.reg.ai],
    );
    c(
      "niente dati personali nei file salvati se non quelli della lettura (nessun campo in più)",
      true,
      !/dataNascita|numeroTessera/i.test(w.m.get(kF(L, 1))),
    );
  }
  {
    //  Un file già letto nel gruppo: l'AI riceve solo gli altri due.
    const w = mondo();
    semina(w, { n: 3 });
    const f1 = JSON.parse(w.m.get(kF(L, 1)));
    w.m.set(
      kF(L, 1),
      JSON.stringify({
        ...f1,
        stato: "letto",
        tipo: "tessera",
        lettura: JSON.parse(jsonAi(["tessera"])).immagini[0],
      }),
    );
    w.risposteAi = () => ({ testo: jsonAi(["indirizzo", "pagamento"]), fine: "stop" });
    const r = await post(w, { azione: "leggi-gruppo", lotto: L, gruppo: 0 });
    c(
      "gruppo con un file già letto → l'AI riceve 2 immagini; i tipi finiscono ai file giusti",
      [200, [2], ["indirizzo", "tessera", "pagamento"]],
      [r.stato, w.reg.aiImmagini, r.corpo.file.map((f) => f.tipo)],
    );
  }
  {
    //  Due schede insieme.
    const w = mondo();
    semina(w);
    let sblocca;
    const ferma = new Promise((ok) => {
      sblocca = ok;
    });
    w.risposteAi = async () => {
      await ferma;
      return { testo: jsonAi(["indirizzo", "tessera", "pagamento"]), fine: "stop" };
    };
    const a = post(w, { azione: "leggi-gruppo", lotto: L, gruppo: 0 });
    await new Promise((ok) => setTimeout(ok, 20));
    const b = await post(w, { azione: "leggi-gruppo", lotto: L, gruppo: 0 });
    sblocca();
    const ra = await a;
    c(
      "due schede insieme → UNA sola chiamata AI; la seconda riceve «occupato» (409), non un guasto",
      [200, 409, "occupato", 1],
      [ra.stato, b.stato, b.corpo.codice, w.reg.ai],
    );
  }
  {
    //  La seconda scheda aveva letto prima che la prima finisse: dopo il reclamo rilegge e non paga di nuovo.
    const w = mondo();
    semina(w);
    w.hook.dopoPrefisso = async () => {
      await post(w, { azione: "leggi-gruppo", lotto: L, gruppo: 0 });
    };
    const r = await post(w, { azione: "leggi-gruppo", lotto: L, gruppo: 0 });
    c(
      "la seconda scheda, partita con una lettura vecchia, rilegge dopo il reclamo → ancora UNA chiamata AI",
      [200, 1, ["letto", "letto", "letto"]],
      [r.stato, w.reg.ai, r.corpo.file.map((f) => f.stato)],
    );
  }
  {
    //  Reclamo scaduto (di una scheda morta) → si riprende; vivo → occupato.
    const w = mondo();
    semina(w);
    w.m.set(kC(L, 0), JSON.stringify({ id: "morta", fino: new Date(T0 - 1000).toISOString() }));
    const r = await post(w, { azione: "leggi-gruppo", lotto: L, gruppo: 0 });
    c(
      "reclamo SCADUTO di una scheda morta → ripreso (compare-and-swap) e il gruppo si legge",
      [200, 1],
      [r.stato, w.reg.ai],
    );
    const w2 = mondo();
    semina(w2);
    w2.m.set(kC(L, 0), JSON.stringify({ id: "altra", fino: new Date(T0 + 60_000).toISOString() }));
    const o = await post(w2, { azione: "leggi-gruppo", lotto: L, gruppo: 0 });
    c(
      "reclamo vivo di un'altra scheda → codice «occupato» e NESSUNA chiamata AI",
      [409, "occupato", 0],
      [o.stato, o.corpo.codice, w2.reg.ai],
    );
    const c90 = readFileSync(join(RADICE, "src/crm/fatture/bulk/chiavi.ts"), "utf8");
    c(
      "la scadenza del reclamo (90 s) è più lunga del tentativo AI (55 s)",
      true,
      /SCADENZA_RECLAMO_MS = 90_000/.test(c90) && /TIMEOUT_AI_MS = 55_000/.test(c90),
    );
  }
  {
    //  Un tentativo, mai ripetuto; codici distinti.
    const casi = [
      [{ errore: "limite" }, 429, "limite"],
      [{ errore: "credito" }, 402, "credito"],
      [{ errore: "timeout" }, 504, "timeout"],
      [{ errore: "rete" }, 502, "rete"],
      [{ testo: '{"immagini":[{"immagine":1,"tipo":"altro"', fine: "length" }, 502, "troncata"],
      [{ testo: "non è json", fine: "stop" }, 502, "illeggibile"],
    ];
    const visti = [];
    for (const [esito, stato, codice] of casi) {
      const w = mondo();
      semina(w);
      w.risposteAi = () => esito;
      const r = await post(w, { azione: "leggi-gruppo", lotto: L, gruppo: 0 });
      visti.push([r.stato, r.corpo.codice, w.reg.ai, w.m.has(kC(L, 0))]);
      void stato;
      void codice;
    }
    c(
      "429/402/timeout/rete/troncata/illeggibile → codici distinti, UNA chiamata ciascuno (nessuna ripetizione), reclamo rilasciato",
      casi.map(([, s, k]) => [s, k, 1, false]),
      visti,
    );
    const w = mondo();
    semina(w);
    w.risposteAi = () => ({ testo: "{", fine: "length" });
    await post(w, { azione: "leggi-gruppo", lotto: L, gruppo: 0 });
    const ancora = await post(w, { azione: "leggi-gruppo", lotto: L, gruppo: 0 });
    c(
      "`troncata` si ricorda sui file e leggi-gruppo non la ripaga da solo",
      [200, 1, ["errore", "errore", "errore"], "troncata"],
      [ancora.stato, w.reg.ai, ancora.corpo.file.map((f) => f.stato), ancora.corpo.file[0].errore],
    );
  }
  {
    //  Il 404 di OpenRouter per «deny»: messaggio chiaro, e `deny` resta nella richiesta.
    const chiamate = [];
    const fetchFinto = (risposta) => async (url, init) => {
      chiamate.push({ url, init });
      return risposta(init);
    };
    const risp = (stato, testo) => () => new Response(testo, { status: stato });
    const corpoDeny = JSON.stringify({
      error: {
        code: 404,
        message: "No endpoints found matching your data policy (Zero data retention).",
      },
    });
    const oggi = async (f) =>
      B.chiamaOpenRouter({
        fetch: f,
        chiave: "chiave-finta-lunga",
        immagini: [JPEG, JPEG],
        timeoutMs: 50,
      });
    const deny = await oggi(fetchFinto(risp(404, corpoDeny)));
    c(
      "404 «data policy» → messaggio chiaro (non «non trovato» generico), codice dedicato «politica_dati»",
      [true, true, true],
      [
        deny.errore === "politica_dati",
        /non conservare i dati/.test(deny.messaggio),
        /tessere sanitarie/.test(deny.messaggio),
      ],
    );
    c(
      "e il testo della risposta di OpenRouter non finisce nel messaggio",
      false,
      JSON.stringify(deny).includes("Zero data retention"),
    );
    const corpoInviato = JSON.parse(chiamate[0].init.body);
    c(
      "la richiesta porta `data_collection: deny`, max_tokens 1500, ragionamento spento, 2 immagini, chiave nell'intestazione",
      ["deny", 1500, "none", 3, true],
      [
        corpoInviato.provider.data_collection,
        corpoInviato.max_tokens,
        corpoInviato.reasoning.effort,
        corpoInviato.messages[0].content.length,
        /^Bearer chiave-finta/.test(chiamate[0].init.headers.Authorization),
      ],
    );
    c("un solo fetch per chiamata (nessuna ripetizione)", 1, chiamate.length);
    c(
      "404 qualunque altro → messaggio sul modello",
      true,
      /modello/.test((await oggi(fetchFinto(risp(404, "boh")))).messaggio),
    );
    const mappa = [];
    for (const s of [402, 429, 408, 504, 500, 503, 400, 401])
      mappa.push((await oggi(fetchFinto(risp(s, "x")))).errore);
    c(
      "402/429/408/504/500/503/400/401 → credito/limite/timeout/timeout/rete/rete/interno/interno",
      ["credito", "limite", "timeout", "timeout", "rete", "rete", "interno", "interno"],
      mappa,
    );
    c(
      "200 con un oggetto `error` dentro (429) → limite",
      "limite",
      (await oggi(fetchFinto(risp(200, JSON.stringify({ error: { code: 429 } }))))).errore,
    );
    c(
      "fetch che lancia → rete",
      "rete",
      (
        await oggi(async () => {
          throw new TypeError("giù");
        })
      ).errore,
    );
    const t0 = Date.now();
    const lento = await oggi(
      (_u, init) =>
        new Promise((_ok, no) =>
          init.signal.addEventListener("abort", () =>
            no(Object.assign(new Error("a"), { name: "AbortError" })),
          ),
        ),
    );
    c(
      "nessuna risposta entro la scadenza → «timeout» (interrotto dal timer)",
      [true, true],
      [lento.errore === "timeout", Date.now() - t0 < 1500],
    );
    const buono = await oggi(
      fetchFinto(
        risp(
          200,
          JSON.stringify({ choices: [{ message: { content: "ciao" }, finish_reason: "stop" }] }),
        ),
      ),
    );
    c("risposta buona → testo e motivo di fine", [{ testo: "ciao", fine: "stop" }], [buono]);
  }

  /* ═════ 5. RILEGGI ═════ */
  gruppo("BULK · T9 · RILEGGI");
  {
    const w = mondo();
    semina(w, { tipi: ["indirizzo", "tessera", "pagamento"], stato: "letto", conLettura: true });
    w.risposteAi = () => ({ testo: jsonAi(["tessera"]), fine: "stop" });
    const r = await post(w, { azione: "rileggi", lotto: L, indici: [1] });
    c(
      "rileggi un file → UNA chiamata con 1 immagine, lettura nuova scritta",
      [200, [1], "tessera"],
      [r.stato, w.reg.aiImmagini, JSON.parse(w.m.get(kF(L, 1))).lettura.tipo],
    );
    w.risposteAi = () => ({ errore: "timeout" });
    const prima = w.m.get(kF(L, 2));
    const x = await post(w, { azione: "rileggi", lotto: L, indici: [2] });
    c(
      "se la rilettura fallisce la lettura di prima resta (il tipo decide i raggruppamenti)",
      [504, true],
      [x.stato, w.m.get(kF(L, 2)) === prima],
    );
    c(
      "rileggi: troppi indici o ripetuti → rifiutato",
      [400, 400],
      [
        (await post(w, { azione: "rileggi", lotto: L, indici: [0, 1, 2, 3] })).stato,
        (await post(w, { azione: "rileggi", lotto: L, indici: [1, 1] })).stato,
      ],
    );
  }

  /* ═════ 6. LETTURA DEL LOTTO E MINIATURE ═════ */
  gruppo("BULK · T9 · GET: ELENCO, DETTAGLIO, MINIATURE (E UN GET NON CANCELLA MAI)");
  {
    const w = mondo();
    semina(w, {
      n: 9,
      tipi: [
        "indirizzo",
        "tessera",
        "pagamento",
        "indirizzo",
        "tessera",
        "pagamento",
        "indirizzo",
        "tessera",
        "pagamento",
      ],
    });
    semina(w, { lotto: "altro-lotto-01", n: 3 });
    w.m.set(
      kR(L, "0000-0001-0002"),
      JSON.stringify({
        idRiga: "0000-0001-0002",
        stato: "emessa",
        emessa: { id: "2026-0001", numero: 1, data: "2026-10-01" },
      }),
    );
    const fotoPrima = w.bucket.size;
    const chiaviPrima = w.m.size;
    const e = await get(w, "");
    const mio = e.corpo.find((x) => x.lotto === L);
    c(
      "elenco: un array di lotti con file e righe (nessun «ok» attorno, come lo legge usa-lotto)",
      [200, 2, 9, 1, 2],
      [e.stato, e.corpo.length, mio.file, mio.righeEmesse, mio.righeAperte],
    );
    const d = await get(w, `?lotto=${L}`);
    c(
      "dettaglio: testata, 9 file ordinati, la riga emessa",
      [200, 9, [0, 1, 2, 3, 4, 5, 6, 7, 8], 1],
      [d.stato, d.corpo.file.length, d.corpo.file.map((f) => f.indice), d.corpo.righe.length],
    );
    c(
      "il dettaglio non mostra percorsi del bucket",
      false,
      JSON.stringify(d.corpo).includes("bulk/"),
    );
    const u = await get(w, `?lotto=${L}&url=0000,0001`);
    c(
      "miniature: URL firmati per 60 s, solo i file chiesti",
      [200, ["0000", "0001"], [60, 60]],
      [u.stato, Object.keys(u.corpo), w.reg.firme],
    );
    c(
      "più di 6 URL in una chiamata → rifiutato; indice non numerico → rifiutato",
      [400, 400],
      [
        (await get(w, `?lotto=${L}&url=0,1,2,3,4,5,6`)).stato,
        (await get(w, `?lotto=${L}&url=a`)).stato,
      ],
    );
    c(
      "lotto inesistente → 404; id strano → 400",
      [404, 400],
      [(await get(w, "?lotto=lotto-nonesiste")).stato, (await get(w, "?lotto=%25")).stato],
    );
    c(
      "UN GET NON CANCELLA MAI: nessuna rimozione dal bucket, nessuna cancellazione di chiavi, stesso contenuto",
      [0, 0, 0, fotoPrima, chiaviPrima],
      [
        w.reg.rimuovi.length,
        w.reg.eliminate.length,
        w.reg.prefissiCancellati.length,
        w.bucket.size,
        w.m.size,
      ],
    );
    //  Un file che punta fuori dal lotto non si firma.
    w.m.set(
      kF(L, 1),
      JSON.stringify({
        indice: 1,
        stato: "salvato",
        impronta: hex64(2),
        tipo: "",
        percorso: `${U}/bulk/altro-lotto-01/${uuid(1)}.jpg`,
      }),
    );
    w.m.set(
      kF(L, 2),
      JSON.stringify({
        indice: 2,
        stato: "salvato",
        impronta: hex64(3),
        tipo: "",
        percorso: `${U}/../altro-utente/${uuid(2)}.jpg`,
      }),
    );
    w.m.set(
      kF(L, 3),
      JSON.stringify({
        indice: 3,
        stato: "scartata",
        impronta: hex64(4),
        tipo: "",
        percorso: `${U}/bulk/${L}/${uuid(3)}.jpg`,
      }),
    );
    const f = await get(w, `?lotto=${L}&url=0001,0002,0003,0004`);
    c(
      "percorso di un altro lotto, percorso con «..», file già scartato → mai firmati; il file vero sì",
      [["0004"]],
      [Object.keys(f.corpo)],
    );
  }

  /* ═════ 7. RIGHE, SCARTO, CHIUSURA DEL LOTTO ═════ */
  gruppo("BULK · T9 · SALVA-RIGA, SCARTO, CHIUSURA E RITENTATIVO");
  {
    const w = mondo();
    semina(w, {
      n: 6,
      tipi: ["indirizzo", "tessera", "pagamento", "indirizzo", "tessera", "pagamento"],
      stato: "letto",
      conLettura: true,
    });
    const id1 = "0000-0001-0002",
      id2 = "0003-0004-0005";
    const conf = await post(w, {
      azione: "salva-riga",
      lotto: L,
      idRiga: id1,
      confermaRiga: true,
      confermaAvvisi: ["importo_alto", "importo_alto"],
    });
    c(
      "conferma riga e avvisi (per codice, senza doppioni)",
      [200, true, ["importo_alto"]],
      [conf.stato, conf.corpo.riga.confermata, conf.corpo.riga.confermeAvvisi],
    );
    const mod = await post(w, {
      azione: "salva-riga",
      lotto: L,
      idRiga: id1,
      modifiche: { cap: "20121", importo: 99.5 },
    });
    c(
      "ogni modifica di un campo TOGLIE la conferma (riga e avvisi) e unisce alle precedenti",
      [false, [], "20121", 99.5],
      [
        mod.corpo.riga.confermata,
        mod.corpo.riga.confermeAvvisi,
        mod.corpo.riga.modifiche.cap,
        mod.corpo.riga.modifiche.importo,
      ],
    );
    c(
      "modifica e conferma nella stessa richiesta → rifiutata",
      400,
      (
        await post(w, {
          azione: "salva-riga",
          lotto: L,
          idRiga: id1,
          modifiche: { cap: "1" },
          confermaRiga: true,
        })
      ).stato,
    );
    c(
      "campo sconosciuto / carattere di controllo / modo strano / data impossibile / importo negativo → rifiutati",
      [400, 400, 400, 400, 400],
      [
        (await post(w, { azione: "salva-riga", lotto: L, idRiga: id1, modifiche: { ruolo: "x" } }))
          .stato,
        (
          await post(w, {
            azione: "salva-riga",
            lotto: L,
            idRiga: id1,
            modifiche: { nome: "a\u0000b" },
          })
        ).stato,
        (
          await post(w, {
            azione: "salva-riga",
            lotto: L,
            idRiga: id1,
            modifiche: { modo: "paypal" },
          })
        ).stato,
        (
          await post(w, {
            azione: "salva-riga",
            lotto: L,
            idRiga: id1,
            modifiche: { data: "2026-13-01" },
          })
        ).stato,
        (await post(w, { azione: "salva-riga", lotto: L, idRiga: id1, modifiche: { importo: -1 } }))
          .stato,
      ],
    );
    c(
      "riga che non esiste nel lotto / id riga non canonico → 404 / 400",
      [404, 400],
      [
        (
          await post(w, {
            azione: "salva-riga",
            lotto: L,
            idRiga: "0000-0001-0009",
            confermaRiga: true,
          })
        ).stato,
        (await post(w, { azione: "salva-riga", lotto: L, idRiga: "0002-0001", confermaRiga: true }))
          .stato,
      ],
    );

    //  Scarto con la cancellazione dal bucket che FALLISCE: la riga resta scartata, i dati sono già vuoti.
    w.rotte.rimuoviFallisce = 1;
    w.azzera();
    const sc = await post(w, { azione: "salva-riga", lotto: L, idRiga: id1, scarta: true });
    const sottoScarto = w.reg.subs;
    const f0 = JSON.parse(w.m.get(kF(L, 0)));
    c(
      "scarto con rimozione del bucket fallita → la riga RESTA scartata e i file sono già svuotati (solo {indice,stato,impronta,tipo})",
      [200, "scartata", false, ["impronta", "indice", "stato", "tipo"], 6, true],
      [
        sc.stato,
        sc.corpo.riga.stato,
        sc.corpo.lottoChiuso,
        Object.keys(f0).sort(),
        w.bucket.size,
        sotto(sottoScarto),
      ],
    );
    c(
      "la riga scartata non ha più modifiche né conferme",
      ["idRiga,stato"],
      [
        Object.keys(JSON.parse(w.m.get(kR(L, id1))))
          .sort()
          .join(","),
      ],
    );
    c(
      "niente log con dati: solo codici",
      true,
      w.reg.log.every((x) => /^[A-Za-z_-]+( [a-z_]+)?$/.test(x)) || w.reg.log,
    );
    const p = await post(w, { azione: "pulisci", lotto: L });
    c(
      "il ritentativo (pulisci) toglie i 3 file rimasti nel bucket, che ora sono orfani",
      [200, 3, 3],
      [p.stato, p.corpo.rimossi, w.bucket.size],
    );
    c(
      "un GET non l'avrebbe fatto: i file della seconda riga sono ancora tutti lì",
      3,
      w.bucket.size,
    );

    //  Chiude l'altra riga: tutte chiuse → il lotto sparisce.
    const ultima = await post(w, { azione: "salva-riga", lotto: L, idRiga: id2, scarta: true });
    c(
      "scartata anche l'ultima riga → il lotto si chiude da solo (bucket, f, r, c, e, testata)",
      [true, 0, []],
      [
        ultima.corpo.lottoChiuso,
        w.bucket.size,
        [...w.m.keys()].filter((k) => k.startsWith("bulk_fatture_")),
      ],
    );
    c(
      "cancellate per prefisso con i «:» finali (mai il lotto che inizia uguale)",
      true,
      w.reg.prefissiCancellati.every((x) => x.endsWith(":")),
    );
  }
  {
    //  Il lotto con file ancora da leggere non si chiude, nemmeno se «non ha righe».
    const w = mondo();
    semina(w, { n: 3 });
    const x = await post(w, { azione: "pulisci", lotto: L });
    c(
      "lotto con file non ancora letti → pulisci non lo chiude",
      [200, true],
      [x.stato, w.m.has(kT(L))],
    );
  }

  /* ═════ 8. ANNULLA, PULISCI, PREDERE IL CONTROLLO ═════ */
  gruppo("BULK · T9 · ANNULLA E PULISCI: PER PREFISSO, A GRUPPI DI 100, ORFANI");
  {
    const w = mondo();
    semina(w, { n: 250 });
    w.m.set(kR(L, "0000-0001-0002"), "{}");
    w.m.set(kC(L, 0), "{}");
    w.m.set(`bulk_fatture_e:${L}`, "{}");
    w.m.set(kT("lotto-0123abcdef"), "{}"); // un altro lotto che INIZIA uguale: non si tocca
    w.m.set("fattura:2026-0001", "{}");
    w.m.set("bulk_fatture_lock", "{}");
    const { r, subs } = await conta(w, () => post(w, { azione: "annulla", lotto: L }));
    c(
      "annulla con 250 file → 3 `remove` (100+100+50), 3 cancellazioni per prefisso, emittente e testata per chiave",
      [200, 250, [100, 100, 50], 3, true],
      [
        r.stato,
        r.corpo.rimossi,
        w.reg.rimuovi,
        w.reg.prefissiCancellati.length,
        w.reg.eliminate.includes(`bulk_fatture_e:${L}`) && w.reg.eliminate.includes(kT(L)),
      ],
    );
    c(
      "restano: l'altro lotto con id simile, la fattura, il lucchetto globale",
      [true, true, true],
      [w.m.has(kT("lotto-0123abcdef")), w.m.has("fattura:2026-0001"), w.m.has("bulk_fatture_lock")],
    );
    c(
      "del lotto non resta niente",
      [0, 0],
      [
        [...w.m.keys()].filter((k) => k.endsWith(`:${L}`) || k.includes(`:${L}:`)).length,
        w.bucket.size,
      ],
    );
    c("sotto le 40 sottorichieste", true, sotto(subs));
    c(
      "annulla un lotto che non c'è → 404",
      404,
      (await post(w, { azione: "annulla", lotto: L })).stato,
    );
  }
  {
    //  Annulla con 600 file e rimozione che fallisce a metà: le chiavi restano, si può riprovare.
    const w = mondo();
    semina(w, { n: 600 });
    w.rotte.rimuoviFallisce = 1;
    const { r, subs } = await conta(w, () => post(w, { azione: "annulla", lotto: L }));
    c(
      "annulla con 600 file → sotto le 40 sottorichieste; se un `remove` fallisce errore e la testata RESTA (si riprova)",
      [500, true, true],
      [r.stato, w.m.has(kT(L)), sotto(subs)],
    );
    const diNuovo = await post(w, { azione: "annulla", lotto: L });
    c("riprovando, finisce", [200, false], [diNuovo.stato, w.m.has(kT(L))]);
  }
  {
    const w = mondo();
    semina(w, {
      lotto: "lotto-vecchio01",
      n: 600,
      creatoIl: new Date(T0 - 31 * GIORNO).toISOString(),
    });
    semina(w, {
      lotto: "lotto-recente01",
      n: 5,
      creatoIl: new Date(T0 - 29 * GIORNO).toISOString(),
    });
    const orfano = `${U}/bulk/lotto-recente01/${uuid(4242)}.jpg`;
    w.bucket.set(orfano, JPEG); // nel bucket, ma nessuna chiave lo richiama
    const v = await conta(w, () => post(w, { azione: "pulisci", lotto: "lotto-vecchio01" }));
    c(
      "lotto di 31 giorni con 600 file → sparisce con file e chiavi, sotto le 40 sottorichieste",
      [200, 600, false, true],
      [v.r.stato, v.r.corpo.rimossi, w.m.has(kT("lotto-vecchio01")), sotto(v.subs)],
    );
    const r = await post(w, { azione: "pulisci", lotto: "lotto-recente01" });
    c(
      "lotto di 29 giorni → RESTA; solo il file orfano del bucket (senza chiave) viene tolto",
      [200, 1, true, false, 5],
      [
        r.stato,
        r.corpo.rimossi,
        w.m.has(kT("lotto-recente01")),
        w.bucket.has(orfano),
        [...w.bucket.keys()].filter((p) => p.includes("lotto-recente01")).length,
      ],
    );
    c(
      "pulisci senza lotto e senza niente da fare → 0",
      [200, 0],
      await (async () => {
        const x = await post(w, { azione: "pulisci" });
        return [x.stato, x.corpo.rimossi];
      })(),
    );
  }
  {
    const w = mondo();
    semina(w, {
      lotto: "lotto-vecchio01",
      n: 3,
      creatoIl: new Date(T0 - 40 * GIORNO).toISOString(),
    });
    semina(w, {
      lotto: "lotto-vecchio02",
      n: 3,
      creatoIl: new Date(T0 - 45 * GIORNO).toISOString(),
    });
    const a = await post(w, { azione: "pulisci" });
    c(
      "pulisci senza lotto → UN solo lotto per chiamata",
      [1, 3],
      [
        a.corpo.rimossi > 0 ? 1 : 0,
        [...w.m.keys()].filter((k) => k.startsWith("bulk_fatture_t:")).length + 2,
      ],
    );
    //  Cartella del bucket senza lotto (testata sparita, rimozione fallita in passato).
    const w2 = mondo();
    for (let i = 0; i < 2; i++) w2.bucket.set(`${U}/bulk/lotto-sparito01/${uuid(i)}.jpg`, JPEG);
    semina(w2, { n: 3 });
    const b = await post(w2, { azione: "pulisci" });
    c(
      "cartella del bucket di un lotto che non c'è più → ripulita; il lotto vivo resta",
      [2, true, 3],
      [
        b.corpo.rimossi,
        w2.m.has(kT(L)),
        [...w2.bucket.keys()].filter((p) => p.includes(`/${L}/`)).length,
      ],
    );
  }
  {
    const w = mondo();
    semina(w, { n: 3 });
    const a = await post(w, {
      azione: "prendi-controllo",
      lotto: L,
      emittente: "scheda-aaaa-1111",
    });
    const chiave = JSON.parse(w.m.get(`bulk_fatture_e:${L}`));
    c(
      "prendi-controllo → l'emittente del lotto diventa questa scheda",
      [200, "scheda-aaaa-1111"],
      [a.stato, chiave.id],
    );
    const b = await post(w, {
      azione: "prendi-controllo",
      lotto: L,
      emittente: "scheda-bbbb-2222",
    });
    c(
      "anche se è viva di un'altra: si prende, come promesso all'utente",
      [200, "scheda-bbbb-2222"],
      [b.stato, JSON.parse(w.m.get(`bulk_fatture_e:${L}`)).id],
    );
    c(
      "id di scheda strano / lotto che non c'è → 400 / 404",
      [400, 404],
      [
        (await post(w, { azione: "prendi-controllo", lotto: L, emittente: "a b" })).stato,
        (
          await post(w, {
            azione: "prendi-controllo",
            lotto: "lotto-nonesiste",
            emittente: "scheda-aaaa-1111",
          })
        ).stato,
      ],
    );
  }

  /* ═════ 9. SOTTORICHIESTE E CPU ═════ */
  gruppo("BULK · T9 · OGNI AZIONE SOTTO LE 40 SOTTORICHIESTE, ANCHE CON 600 FILE");
  {
    const w = mondo();
    semina(w, { n: 600 });
    const misure = {};
    const mis = async (nome, f) => {
      const { subs } = await conta(w, f);
      misure[nome] = subs;
    };
    await mis("file", () =>
      post(w, { azione: "file", lotto: L, indice: 599 + 0, impronta: hex64(900), dataUrl: JPEG }),
    );
    await mis("leggi-gruppo", () => post(w, { azione: "leggi-gruppo", lotto: L, gruppo: 100 }));
    await mis("rileggi", () => post(w, { azione: "rileggi", lotto: L, indici: [0, 1, 2] }));
    await mis("GET dettaglio", () => get(w, `?lotto=${L}`));
    await mis("GET elenco", () => get(w, ""));
    await mis("GET miniature", () => get(w, `?lotto=${L}&url=0,1,2,3,4,5`));
    await mis("prendi-controllo", () =>
      post(w, { azione: "prendi-controllo", lotto: L, emittente: "scheda-aaaa-1111" }),
    );
    await mis("pulisci", () => post(w, { azione: "pulisci", lotto: L }));
    await mis("annulla", () => post(w, { azione: "annulla", lotto: L }));
    c(
      "file, leggi-gruppo, rileggi, GET, miniature, controllo, pulisci, annulla: tutti ≤ 40 con 600 file",
      Object.keys(misure).map(() => true),
      Object.values(misure).map(sotto),
    );
    //  Elenco con 20 lotti: ne mostra 15 (2 letture a lotto + 1).
    const w2 = mondo();
    for (let i = 0; i < 20; i++)
      semina(w2, {
        lotto: `lotto-n${String(i).padStart(2, "0")}aa`,
        n: 3,
        creatoIl: new Date(T0 - i * 1000).toISOString(),
      });
    const { r, subs } = await conta(w2, () => get(w2, ""));
    c(
      "elenco con 20 lotti → i 15 più recenti, sotto le 40 sottorichieste",
      [15, true],
      [r.corpo.length, sotto(subs)],
    );
  }

  /* ═════ 10. EMISSIONE, LOG, SORGENTE ═════ */
  gruppo("BULK · T9 · EMETTI-RIGA SMISTATO A T12, NIENTE DATI NEI LOG, SORGENTE PULITO");
  {
    const w = mondo();
    const e = await post(w, {
      azione: "emetti-riga",
      lotto: L,
      idRiga: "0000-0001-0002",
      emittente: "scheda-123456",
    });
    c(
      "emetti-riga va all'emissione (T12) e ne riporta l'esito",
      [200, "emetti-riga", "ferma", "finto 0000-0001-0002"],
      [e.stato, e.corpo.azione, e.corpo.esito, e.corpo.messaggio],
    );
    const guasta = {
      ...dip(w),
      emettiRiga: async () => {
        throw new Error("da fare (T12 emettiRiga) Mario Rossi");
      },
    };
    const g = await post(
      w,
      { azione: "emetti-riga", lotto: L, idRiga: "0000-0001-0002", emittente: "scheda-123456" },
      guasta,
    );
    c(
      "se l'emissione lancia (T12 non c'è ancora) → «ferma» con codice interno, e il testo dell'errore non esce",
      [200, "ferma", "interno", false],
      [g.stato, g.corpo.esito, g.corpo.codice, JSON.stringify(g.corpo).includes("Mario")],
    );
    c(
      "azione sconosciuta / corpo non JSON / corpo non oggetto → 400",
      [400, 400, 400],
      [
        (await post(w, { azione: "boh" })).stato,
        (
          await B.gestisciPOST(
            new Request("http://x/", { method: "POST", body: "{non json" }),
            dip(w),
          )
        ).status,
        (await post(w, [1])).stato,
      ],
    );
    c(
      "nessuna intestazione CORS in nessuna risposta; sempre no-store",
      [null, "no-store"],
      [e.intest.get("access-control-allow-origin"), e.intest.get("cache-control")],
    );
    //  Il log del guasto non contiene dati.
    c(
      "i log del guasto sono codici",
      true,
      w.reg.log.every((x) => /^[A-Za-z0-9_-]+( [a-z_]+)?$/.test(x)) || w.reg.log,
    );

    //  archivioSoloBulk / lucchettoSoloBulk
    const prot = B.archivioSoloBulk(w.porte.archivio);
    const luc = B.lucchettoSoloBulk(w.porte.lucchetto);
    w.m.set("fattura:2026-0001", "originale");
    const esiti = [
      await prot.scrivi("fattura:2026-0001", "x"),
      await prot.elimina("fattura:2026-0001"),
      (await prot.creaSeAssente("fattura_bozza:z", "x")).stato,
      await luc.sostituisciSe("fattura:2026-0001", "originale", "x"),
      await luc.eliminaSe("fattura:2026-0001", "originale"),
      await luc.creaSeAssente("fattura:2026-9999", "x"),
    ];
    c(
      "le porte vere non scrivono né cancellano mai fuori da `bulk_fatture_*` (fattura:*, fattura_bozza:*)",
      [true, true, "errore", false, false, false, "originale", false],
      [
        typeof esiti[0] === "string",
        typeof esiti[1] === "string",
        esiti[2],
        esiti[3],
        esiti[4],
        esiti[5],
        w.m.get("fattura:2026-0001"),
        w.m.has("fattura:2026-9999"),
      ],
    );
    c(
      "dentro il bulk passano",
      [null, "creata"],
      [
        await prot.scrivi("bulk_fatture_t:xyz1", "{}"),
        (await prot.creaSeAssente("bulk_fatture_t:xyz2", "{}")).stato,
      ],
    );

    //  Si guarda il CODICE: i commenti dicono (giustamente) «niente console».
    const src = readFileSync(join(RADICE, "src/crm/fatture/bulk/bulk.server.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    const rotta = readFileSync(join(RADICE, "src/routes/api.crm.fatture-bulk.ts"), "utf8");
    c(
      "bulk.server.ts: nessun console.*, nessun process.env, nessuna chiave scritta",
      [false, false, false],
      [/console\./.test(src), /process\.env/.test(src), /sk-or-|Bearer [A-Za-z0-9]{20}/.test(src)],
    );
    c(
      "la rotta: log solo con un codice, nessun Access-Control, un solo posto dove si scrive il bucket privato",
      [true, false, true],
      [
        /console\.warn\(`\[fatture-bulk\] \$\{codice\}`\)/.test(rotta),
        /Access-Control/i.test(rotta),
        /BUCKET_DATI_FATTURA/.test(rotta),
      ],
    );
    c(
      "nessun «fattura:» scritto o cancellato dal magazzino (solo letture indirette: nessuna chiave fattura nel sorgente)",
      false,
      /["'`]fattura[:_]/.test(src),
    );
  }

  /* ═════ 11. DOPO LA REVISIONE (T9 DA RIFARE) ═════ */
  gruppo("BULK · T9 · REVISIONE · RILEGGI E SCHEDA TOLGONO LE CONFERME");
  {
    const w = mondo();
    semina(w, {
      n: 6,
      tipi: ["indirizzo", "tessera", "pagamento", "indirizzo", "tessera", "pagamento"],
      stato: "letto",
      conLettura: true,
    });
    const id1 = "0000-0001-0002",
      id2 = "0003-0004-0005";
    for (const id of [id1, id2])
      await post(w, {
        azione: "salva-riga",
        lotto: L,
        idRiga: id,
        confermaRiga: true,
        confermaAvvisi: ["importo_alto"],
      });
    w.risposteAi = () => ({ testo: jsonAi(["tessera"]), fine: "stop" });
    await post(w, { azione: "rileggi", lotto: L, indici: [1] });
    const r1 = JSON.parse(w.m.get(kR(L, id1))),
      r2 = JSON.parse(w.m.get(kR(L, id2)));
    c(
      "conferma → rileggi un file della riga → la riga NON è più confermata (né gli avvisi); l'altra riga resta confermata",
      [false, [], true, ["importo_alto"]],
      [r1.confermata, r1.confermeAvvisi, r2.confermata, r2.confermeAvvisi],
    );
    await post(w, {
      azione: "salva-riga",
      lotto: L,
      idRiga: id1,
      confermaRiga: true,
      scheda: "scheda-aaa",
    }).then((x) => c("scheda e conferma nella stessa richiesta → rifiutata", 400, x.stato));
    await post(w, { azione: "salva-riga", lotto: L, idRiga: id1, scheda: "scheda-aaa" });
    await post(w, {
      azione: "salva-riga",
      lotto: L,
      idRiga: id1,
      confermaRiga: true,
      confermaAvvisi: ["importo_alto"],
    });
    const stessa = await post(w, {
      azione: "salva-riga",
      lotto: L,
      idRiga: id1,
      scheda: "scheda-aaa",
    });
    c(
      "la stessa scheda riscritta → la conferma resta",
      [true, ["importo_alto"]],
      [stessa.corpo.riga.confermata, stessa.corpo.riga.confermeAvvisi],
    );
    const cambia = await post(w, {
      azione: "salva-riga",
      lotto: L,
      idRiga: id1,
      scheda: "scheda-bbb",
    });
    c(
      "conferma → cambio di scheda → NON più confermata (la fattura andrebbe a un'altra persona)",
      [false, [], "scheda-bbb"],
      [cambia.corpo.riga.confermata, cambia.corpo.riga.confermeAvvisi, cambia.corpo.riga.scheda],
    );
    const nullo = await post(w, { azione: "salva-riga", lotto: L, idRiga: id2, scheda: null });
    c(
      "«nessuna scheda» al posto dell'abbinamento automatico è un cambio: toglie la conferma",
      false,
      nullo.corpo.riga.confermata,
    );
  }

  gruppo("BULK · T9 · REVISIONE · UNA TRANSIZIONE DI STATO NON SI SOVRASCRIVE (CAS)");
  {
    const id1 = "0000-0001-0002";
    const emessa = JSON.stringify({
      idRiga: id1,
      stato: "emessa",
      emessa: { id: "2026-0001", numero: 1, data: "2026-10-01" },
    });
    const nuovaW = (esiste) => {
      const w = mondo();
      semina(w, { tipi: ["indirizzo", "tessera", "pagamento"], stato: "letto", conLettura: true });
      if (esiste) w.m.set(kR(L, id1), JSON.stringify({ idRiga: id1, stato: "aperta" }));
      w.hook.dopoLeggiRiga = async () => {
        w.m.set(kR(L, id1), emessa);
      };
      return w;
    };
    for (const esiste of [true, false]) {
      const w = nuovaW(esiste);
      const x = await post(w, { azione: "salva-riga", lotto: L, idRiga: id1, confermaRiga: true });
      c(
        `${esiste ? "riga presente" : "riga assente"}: emessa fra la lettura e la scrittura → salva-riga risponde «conflitto» e la riga resta emessa`,
        [409, "conflitto", emessa],
        [x.stato, x.corpo.codice, w.m.get(kR(L, id1))],
      );
      const w2 = nuovaW(esiste);
      const y = await post(w2, { azione: "salva-riga", lotto: L, idRiga: id1, scarta: true });
      c(
        `${esiste ? "riga presente" : "riga assente"}: stessa gara sullo SCARTO → «conflitto», riga emessa intatta, file con la loro lettura`,
        [409, "conflitto", emessa, true, 3],
        [
          y.stato,
          y.corpo.codice,
          w2.m.get(kR(L, id1)),
          !!JSON.parse(w2.m.get(kF(L, 0))).lettura,
          w2.bucket.size,
        ],
      );
    }
    const w3 = mondo();
    semina(w3, { tipi: ["indirizzo", "tessera", "pagamento"], stato: "letto", conLettura: true });
    let esito = "";
    try {
      await B.chiudiRiga(w3.porte, L, id1, "emessa", {
        id: "2026-0001",
        numero: 1,
        data: "2026-10-01",
      });
    } catch (e) {
      esito = e.codice;
    }
    c(
      "chiudiRiga (per T12) su riga aperta/assente → emessa; due volte la stessa transizione è ammessa; scartata dopo emessa → conflitto",
      ["", "emessa"],
      [esito, JSON.parse(w3.m.get(kR(L, id1))).stato],
    );
    try {
      await B.chiudiRiga(w3.porte, L, id1, "scartata");
    } catch (e) {
      esito = e.codice;
    }
    c(
      "…scartare una riga già emessa → «conflitto»",
      ["conflitto", "emessa"],
      [esito, JSON.parse(w3.m.get(kR(L, id1))).stato],
    );
  }

  gruppo(
    "BULK · T9 · REVISIONE · FILE CON IMPRONTA DIVERSA, PULIZIA SENZA GARA, CORPO, CODICE POLITICA_DATI",
  );
  {
    const w = mondo();
    w.m.set(
      kT(L),
      JSON.stringify({
        lotto: L,
        creatoIl: new Date(T0).toISOString(),
        descrizione: "x",
        dataSeManca: "",
        firmaImpostazioni: "x",
      }),
    );
    const corpo = (imp) => ({
      azione: "file",
      lotto: L,
      indice: 4,
      impronta: hex64(imp),
      dataUrl: JPEG,
    });
    await post(w, corpo(5));
    const stesso = await post(w, corpo(5));
    const altro = await post(w, corpo(6));
    c(
      "stesso indice, STESSA impronta → «gia»; impronta DIVERSA → «conflitto» (409), il file di prima resta",
      ["gia", 409, "conflitto", hex64(5)],
      [stesso.corpo.esito, altro.stato, altro.corpo.codice, JSON.parse(w.m.get(kF(L, 4))).impronta],
    );
  }
  {
    //  `pulisci {}` elenca il bucket PRIMA di leggere le testate: un lotto nato nel mezzo non sembra orfano.
    const w = mondo();
    w.hook.dopoPrimoAccesso = async () => {
      semina(w, { lotto: "lotto-nuovo01", n: 2 });
    };
    const x = await post(w, { azione: "pulisci" });
    c(
      "un lotto creato (testata + file) fra le due letture di `pulisci {}` NON viene cancellato",
      [200, 0, true, 2],
      [
        x.stato,
        x.corpo.rimossi,
        w.m.has(kT("lotto-nuovo01")),
        [...w.bucket.keys()].filter((p) => p.includes("lotto-nuovo01")).length,
      ],
    );
  }
  {
    const w = mondo();
    const grande = await B.gestisciPOST(
      new Request("http://x/api/crm/fatture-bulk", {
        method: "POST",
        body: " ".repeat(13_000_000),
      }),
      dip(w),
    );
    c(
      "corpo di 13 MB → rifiutato (400) senza toccare le porte",
      [400, 0],
      [grande.status, w.reg.subs],
    );
    const src = readFileSync(join(RADICE, "src/crm/fatture/bulk/bulk.server.ts"), "utf8");
    c(
      "COMANDI: i caratteri bidi sono scritti come \\u (nessun carattere invisibile nel sorgente)",
      [false, true],
      [/[‪-‮⁦-⁩]/.test(src), /\\u202a-\\u202e\\u2066-\\u2069/.test(src)],
    );
    const frasi = readFileSync(join(RADICE, "src/crm/fatture/bulk/usa-lotto.ts"), "utf8");
    const tipi = readFileSync(join(RADICE, "src/crm/fatture/bulk/tipi.ts"), "utf8");
    c(
      "`politica_dati` è nei tipi, nelle frasi di usa-lotto e nei codici che fermano la coda",
      [true, true, true],
      [
        /\| "politica_dati"/.test(tipi),
        /politica_dati/.test(frasi),
        /"politica_dati"/.test(readFileSync(join(RADICE, "src/crm/fatture/bulk/coda.ts"), "utf8")),
      ],
    );
    const w2 = mondo();
    semina(w2);
    w2.risposteAi = () => ({ errore: "politica_dati", messaggio: B.MESSAGGIO_POLITICA_DATI });
    const r = await post(w2, { azione: "leggi-gruppo", lotto: L, gruppo: 0 });
    c(
      "leggi-gruppo con 404 deny → 502, codice «politica_dati», messaggio chiaro",
      [502, "politica_dati", true],
      [r.stato, r.corpo.codice, /non conservare i dati/.test(r.corpo.messaggio)],
    );
  }
}
