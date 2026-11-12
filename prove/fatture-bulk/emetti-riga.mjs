/** ── FATTURE BULK · T12 · L'AZIONE `emetti-riga` ───────────────────────────
 *  Si prova `emissione.server.ts` con PORTE FINTE in memoria (archivio protetto, lucchetti, bucket, schede):
 *  niente rete, niente database. Ogni porta CONTA le sottorichieste che farebbe sul serio (una pagina di
 *  lettura = 1, una `leggiMolte` di 120 chiavi = 3), così il tetto di 40 per azione si prova davvero, e ogni
 *  chiamata ha il suo massimo. Le gare sono simulate con punti d'innesto (`w.quando`). Dati di fantasia.
 *  La prova sul database vero è T15; il tempo vero su Cloudflare non si misura qui (la misura sotto è la
 *  CPU di Node sul finto: byte e millisecondi di lettura e parse delle emesse). */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cfConControllo } from "./dati.mjs";

const L = "lotto-0123abcd";
const L2 = "lotto-9999beef";
const U = "utente-uno";
const T0 = Date.parse("2026-11-12T10:00:00.000Z");

const pivaConControllo = (dieci) => {
  let s = 0;
  for (let i = 0; i < 10; i++) {
    let d = Number(dieci[i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    s += d;
  }
  return dieci + String((10 - (s % 10)) % 10);
};
const PIVA = pivaConControllo("1234567001");
const AZIENDA = {
  denominazione: "ESEMPIO CAPELLI S.R.L.",
  partitaIva: PIVA,
  codiceFiscale: PIVA,
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

const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const kT = (lotto) => `bulk_fatture_t:${lotto}`;
const kF = (lotto, i) => `bulk_fatture_f:${lotto}:${String(i).padStart(4, "0")}`;
const kR = (lotto, id) => `bulk_fatture_r:${lotto}:${id}`;
const kE = (lotto) => `bulk_fatture_e:${lotto}`;
const idDi = (k) => [3 * k, 3 * k + 1, 3 * k + 2].map((i) => String(i).padStart(4, "0")).join("-");

/** Il k-esimo cliente di fantasia: tutto diverso dagli altri (nome, CF, telefono, CRO, importo), niente che somigli a un doppione. */
const LETTERE = "abcdefghij";
const nome = (k) =>
  `Ana${LETTERE[k % 10]}${LETTERE[Math.floor(k / 10) % 10]}${LETTERE[Math.floor(k / 100) % 10]}`;
const cognome = (k) =>
  `Rossi${LETTERE[(k * 7) % 10]}${LETTERE[Math.floor(k / 10) % 10]}${LETTERE[Math.floor(k / 100) % 10]}`;
//  Il CF segue nome e cognome (le regole controllano la corrispondenza): i primi 6 caratteri vengono da `codice-fiscale`.
let CFM;
const cfK = (k) =>
  cfConControllo(
    `${CFM.codiceCognome(cognome(k))}${CFM.codiceNome(nome(k))}${50 + (k % 50)}${"ABCDEHLMPRST"[Math.floor(k / 50) % 12]}${String(1 + (k % 28)).padStart(2, "0")}H501`,
  );
const MODI = ["pos", "bonifico", "contanti", "carta"];

function lettureDi(k, o = {}) {
  return {
    indirizzo: {
      tipo: "indirizzo",
      indirizzo: `Via dei Tigli ${k + 1}`,
      cap: "20100",
      comune: "Milano",
      provincia: "MI",
      telefono: String(331000000 + k),
      nome: nome(k),
      cognome: cognome(k),
      indirizzoDiSpedizione: false,
      incerti: [],
    },
    tessera: {
      tipo: "tessera",
      nome: nome(k),
      cognome: cognome(k),
      codiceFiscale: o.cf ?? cfK(k),
      cfLetto: o.cf ?? cfK(k),
      incerti: [],
    },
    pagamento: {
      tipo: "pagamento",
      importo: o.importo ?? 60 + k,
      importoAltro: null,
      valuta: "EUR",
      esito: "completato",
      data: o.data ?? "2026-11-05",
      meseGiorno: "",
      dataTesto: "05/11/2026",
      annoVisibile: true,
      formatoAmbiguo: false,
      modo: o.modo ?? MODI[k % 4],
      modoIncerto: false,
      riferimento: o.riferimento ?? `CRO${String(10000000 + k)}`,
      paganteCognome: cognome(k),
      incerti: [],
    },
  };
}

/* ═══ IL MONDO FINTO ═══════════════════════════════════════════════════════ */
function mondo(mod) {
  const m = new Map();
  const bucket = new Map();
  const reg = {
    vietate: [],
    traccia: {},
    subs: 0,
    log: [],
    byteEmesse: 0,
    letteEmesse: 0,
    rimuovi: 0,
  };
  const w = {
    m,
    bucket,
    reg,
    ora: T0,
    quando: {},
    rotte: { rimuoviFallisce: 0, sostituisciFallisceSu: null, scriviFallisce: null },
    n: 0,
    schede: [],
  };
  w.id = () => uuid(++w.n);
  const sub = (k = 1, chi = "") => {
    reg.subs += k;
    reg.traccia[chi] = (reg.traccia[chi] ?? 0) + k;
  };
  const ordinate = (p) =>
    [...m]
      .filter(([k]) => k.startsWith(p))
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([key, value]) => ({ key, value }));
  let letture = 0;
  const archivio = {
    leggi: async (k) => {
      sub(1, "archivio.leggi");
      return m.get(k) ?? null;
    },
    leggiPrefisso: async () => {
      throw new Error("la lettura non paginata non va usata");
    },
    leggiPrefissoPerChiave: async (p) => {
      const righe = ordinate(p);
      sub(Math.floor(righe.length / 1000) + 1, `pagine ${p.split(":")[0]}`);
      if (p === "fattura:") {
        reg.letteEmesse++;
        reg.byteEmesse += righe.reduce((s, r) => s + r.value.length, 0);
      }
      letture++;
      await w.quando.dopoLettura?.(p, righe.length);
      return righe;
    },
    leggiMolte: async (ks) => {
      sub(Math.ceil(ks.length / 50), "leggiMolte");
      return ks.filter((k) => m.has(k)).map((k) => ({ key: k, value: m.get(k) }));
    },
    scrivi: async (k, v) => {
      sub(1, "archivio.scrivi");
      if (!k.startsWith("bulk_fatture_")) reg.vietate.push(`scrivi ${k}`);
      if (w.rotte.scriviFallisce?.volte > 0 && w.rotte.scriviFallisce.re.test(k)) {
        w.rotte.scriviFallisce.volte--;
        return "errore finto";
      }
      m.set(k, v);
      return null;
    },
    elimina: async (k) => {
      sub(1, "archivio.elimina");
      if (!k.startsWith("bulk_fatture_")) reg.vietate.push(`elimina ${k}`);
      m.delete(k);
      return null;
    },
    creaSeAssente: async (k, v) => {
      sub(1, "archivio.creaSeAssente");
      await w.quando.primaDiCrea?.(k);
      if (m.has(k)) return { stato: "esiste" };
      m.set(k, v);
      return { stato: "creata" };
    },
    eliminaPerPrefisso: async (p) => {
      sub(1, "eliminaPerPrefisso");
      if (!p.startsWith("bulk_fatture_")) reg.vietate.push(`prefisso ${p}`);
      for (const k of [...m.keys()]) if (k.startsWith(p)) m.delete(k);
      return null;
    },
  };
  const lucchetto = {
    leggi: async (k) => {
      sub(1, "lucchetto.leggi");
      return m.get(k) ?? null;
    },
    creaSeAssente: async (k, v) => {
      sub(1, "lucchetto.crea");
      if (m.has(k)) return false;
      m.set(k, v);
      return true;
    },
    sostituisciSe: async (k, a, n) => {
      sub(1, "lucchetto.sostituisciSe");
      if (w.rotte.sostituisciFallisceSu?.test(k)) {
        w.rotte.sostituisciFallisceSu = null;
        throw new Error("rete caduta (finta)");
      }
      await w.quando.primaDiSostituire?.(k);
      if (m.get(k) !== a) return false;
      m.set(k, n);
      return true;
    },
    eliminaSe: async (k, a) => {
      sub(1, "lucchetto.eliminaSe");
      if (m.get(k) !== a) return false;
      m.delete(k);
      return true;
    },
  };
  const buck = {
    carica: async () => "non serve",
    scarica: async () => null,
    elenca: async (cartella) => {
      sub(1, "bucket.elenca");
      const nomi = new Set();
      for (const p of bucket.keys())
        if (p.startsWith(cartella)) nomi.add(p.slice(cartella.length).split("/")[0]);
      return [...nomi];
    },
    rimuovi: async (ps) => {
      sub(1, "bucket.rimuovi");
      reg.rimuovi++;
      if (w.rotte.rimuoviFallisce > 0) {
        w.rotte.rimuoviFallisce--;
        return "rimozione finta fallita";
      }
      for (const p of ps) bucket.delete(p);
      return null;
    },
    firma: async () => null,
  };
  //  ⚠️ Le porte sono AVVOLTE con la stessa funzione della rotta (`avvolgiArchivi`): un finto non avvolto non vede i
  //   rifiuti di `archivioSoloBulk`, e una fattura che in produzione non nasce passerebbe lo stesso.
  w.grezzi = { archivio, lucchetto };
  w.porte = {
    ...mod["fatture/bulk/emissione.server"].avvolgiArchivi(archivio, lucchetto),
    bucket: buck,
    ai: async () => ({ errore: "interno" }),
    adesso: () => w.ora,
    id: w.id,
    log: (c) => reg.log.push(c),
    utente: U,
    schede: async () => {
      sub(Math.floor(w.schede.length / 1000) + 1, "schede");
      return w.schede;
    },
  };
  w.azienda = (x = {}) => m.set("fattura_azienda", JSON.stringify({ ...AZIENDA, ...x }));
  w.azienda();
  w.emesseSalvate = () => ordinate("fattura:").map((r) => JSON.parse(r.value));
  w.firma = () => mod["fatture/bulk/regole-lotto"].firmaImpostazioni({ ...AZIENDA });
  return w;
}

/** Un lotto di clienti `ks` (ognuno con le sue opzioni). `r` = le decisioni: di norma confermata, senza avvisi. */
function semina(w, mod, { lotto = L, clienti, confermate = true }) {
  w.m.set(
    kT(lotto),
    JSON.stringify({
      lotto,
      creatoIl: new Date(T0).toISOString(),
      descrizione: "",
      dataSeManca: "",
      firmaImpostazioni: w.firma(),
    }),
  );
  for (const { k, opz = {}, decisioni } of clienti) {
    const l = lettureDi(k, opz);
    ["indirizzo", "tessera", "pagamento"].forEach((tipo, j) => {
      const indice = 3 * k + j;
      const percorso = `${U}/bulk/${lotto}/${uuid(7000 + indice + (lotto === L ? 0 : 5000))}.jpg`;
      w.bucket.set(percorso, "data:image/jpeg;base64,AAAA");
      w.m.set(
        kF(lotto, indice),
        JSON.stringify({
          indice,
          stato: "letto",
          impronta: `${tipo[0]}${String(indice).padStart(8, "0")}`,
          tipo,
          percorso,
          lettura: l[tipo],
        }),
      );
    });
    if (decisioni !== undefined) {
      if (decisioni)
        w.m.set(
          kR(lotto, idDi(k)),
          JSON.stringify({ idRiga: idDi(k), stato: "aperta", ...decisioni }),
        );
    } else if (confermate)
      w.m.set(
        kR(lotto, idDi(k)),
        JSON.stringify({ idRiga: idDi(k), stato: "aperta", confermata: true, confermeAvvisi: [] }),
      );
  }
}

const richiesta = (idRiga, emittente = "scheda-aaaa1111", lotto = L) => ({
  lotto,
  idRiga,
  emittente,
});

export async function prove(mod, { c, gruppo, radice }) {
  CFM = mod["codice-fiscale"];
  const S = mod["fatture/bulk/emissione.server"];
  const B = mod["fatture/bulk/emissione-bulk"];
  const LK = mod["fatture/bulk/lucchetto.server"];
  const T2 = mod["fatture/bulk/raggruppa"];
  const X = mod["fatture/xml"];
  const F = mod["fatture/bulk/da-importo-a-fattura"];
  const cent = (n) => Math.round(n * 100);
  const chiamate = async (w, idRiga, emittente, lotto) => {
    w.reg.subs = 0;
    w.reg.traccia = {};
    const r = await S.emettiRiga(w.porte, richiesta(idRiga, emittente, lotto));
    return { r, subs: w.reg.subs };
  };

  /* ══ 1. CENTO RIGHE, 94 PRONTE E CONFERMATE ═══════════════════════════ */
  gruppo("BULK · T12 · 100 righe, 94 pronte e confermate");
  const NON_CONF = new Set([7, 23, 41, 58, 77, 90]);
  const dataDi = (k) => `2026-11-${String(1 + ((k * 3) % 10)).padStart(2, "0")}`;
  const w = mondo(mod);
  semina(w, mod, {
    clienti: Array.from({ length: 100 }, (_, k) => ({
      k,
      opz: { data: dataDi(k) },
      ...(NON_CONF.has(k) ? { decisioni: null } : {}),
    })),
  });
  const ordine = B.ordineEmissione(
    Array.from({ length: 100 }, (_, k) => ({ k, numero: k + 1, data: dataDi(k) })).filter(
      (x) => !NON_CONF.has(x.k),
    ),
  );
  let maxSubs = 0;
  const esiti = [];
  const t0 = Date.now();
  for (const [i, x] of ordine.entries()) {
    //  Dopo 40 righe la scheda «si chiude»: l'altra prende il posto quando l'emittente scade (2 minuti).
    const scheda = i < 40 ? "scheda-aaaa1111" : "scheda-bbbb2222";
    if (i === 40) {
      const subito = await chiamate(w, idDi(x.k), scheda);
      esiti.push(subito.r);
      c(
        "emittente ancora vivo di un'altra scheda: la riga 41 si ferma",
        ["ferma", "emittente_occupato"],
        [subito.r.esito, subito.r.codice],
      );
      w.ora += 130_000;
    }
    const { r, subs } = await chiamate(w, idDi(x.k), scheda);
    maxSubs = Math.max(maxSubs, subs);
    esiti.push(r);
  }
  const emesse = w.emesseSalvate();
  const tempo = Date.now() - t0;
  c(
    "94 risposte «emessa» su 94 righe confermate",
    94,
    esiti.filter((e) => e.esito === "emessa").length,
  );
  c(
    "94 fatture in archivio, tutte del lotto",
    [94, true],
    [emesse.length, emesse.every((f) => f.origineBulk?.lotto === L)],
  );
  c(
    "numeri consecutivi 1…94, senza buchi né doppioni",
    Array.from({ length: 94 }, (_, i) => i + 1),
    emesse.map((f) => f.numero),
  );
  c(
    "nell'ordine di ordineEmissione (data, a parità il caricamento)",
    ordine.map((x) => idDi(x.k)),
    emesse.map((f) => f.origineBulk.riga),
  );
  c(
    "la data è quella del pagamento, e non scende mai",
    true,
    emesse.every(
      (f, i) => f.data === dataDi(ordine[i].k) && (i === 0 || f.data >= emesse[i - 1].data),
    ),
  );
  c(
    "imponibile + imposta = totale al centesimo",
    true,
    emesse.every((f) => cent(f.imponibile) + cent(f.imposta) === cent(f.totale)),
  );
  c(
    "il totale è quello pagato",
    true,
    emesse.every((f, i) => cent(f.totale) === cent(60 + ordine[i].k)),
  );
  c(
    "il modo di pagamento è quello letto",
    true,
    emesse.every((f, i) => f.metodoPagamento === MODI[ordine[i].k % 4]),
  );
  c(
    "problemiXml: nessun bloccante su nessuna fattura emessa",
    0,
    emesse.filter((f) => X.problemiXml(f, AZIENDA).bloccanti.length).length,
  );
  c("ogni chiamata sotto le 40 sottorichieste (massimo visto)", true, maxSubs <= 40);
  console.log(
    `  info  100 righe: massimo ${maxSubs} sottorichieste per chiamata, ${tempo} ms in tutto (CPU di Node sul finto)`,
  );
  //  Le sei non confermate: intatte, e rifiutate anche chiamando la rotta a mano.
  const mancanti = [...NON_CONF].map((k) => idDi(k));
  c(
    "le 6 non confermate non hanno fattura",
    0,
    emesse.filter((f) => mancanti.includes(f.origineBulk.riga)).length,
  );
  const rifiuto = await chiamate(w, idDi(7), "scheda-bbbb2222");
  c(
    "riga non confermata chiamata a mano → saltata, con i suoi motivi",
    ["saltata", true],
    [rifiuto.r.esito, rifiuto.r.motivi?.length > 0],
  );
  c(
    "le sue foto sono ancora nel bucket (nessuna pulizia)",
    3,
    [...w.bucket.keys()].filter((p) => /0*(7021|7022|7023)\.jpg$/.test(p)).length,
  );
  c("il lotto non è chiuso: ci sono 6 righe aperte", true, w.m.has(kT(L)));
  //  Ricomposizione identica dopo la pulizia: le righe emesse tengono gli stessi idRiga.
  const dopo = [...w.m]
    .filter(([k]) => k.startsWith(`bulk_fatture_f:${L}:`))
    .map(([, v]) => JSON.parse(v));
  const gDopo = T2.ricomponi(dopo.map((f) => ({ indice: f.indice, tipo: f.tipo || "altro" })));
  c(
    "ricomposizione dopo la pulizia: stessi 100 idRiga",
    Array.from({ length: 100 }, (_, k) => idDi(k)),
    gDopo.map((g) => g.idRiga),
  );
  const resid = JSON.parse(w.m.get(kF(L, 3 * ordine[0].k + 2)));
  c(
    "un file emesso resta solo {indice, stato, impronta, tipo}",
    ["emessa", false, false],
    [resid.stato, "lettura" in resid, "percorso" in resid],
  );
  const rr = JSON.parse(w.m.get(kR(L, idDi(ordine[0].k))));
  c(
    "la riga emessa tiene solo stato ed emessa {id, numero, data}",
    ["emessa", ["emessa", "idRiga", "stato"], 1],
    [rr.stato, Object.keys(rr).sort(), rr.emessa.numero],
  );
  //  Le 6 restano emettibili con conferma dopo (ordine delle date invertito: consentito, chiede conferma).
  const prima = await chiamate(w, idDi(7), "scheda-bbbb2222");
  c("prima della conferma ancora ferme", "saltata", prima.r.esito);
  let ultimo;
  for (const k of NON_CONF) {
    const chiave = kR(L, idDi(k));
    const sulPrimo = await chiamate(w, idDi(k), "scheda-bbbb2222");
    if (
      sulPrimo.r.esito === "saltata" &&
      sulPrimo.r.motivi.some((mo) => mo.codice === "data_anteriore")
    ) {
      //  la data è anteriore all'ultima emessa: va confermata per codice, come fa il browser
      w.m.set(
        chiave,
        JSON.stringify({
          idRiga: idDi(k),
          stato: "aperta",
          confermata: true,
          confermeAvvisi: ["data_anteriore"],
        }),
      );
    } else
      w.m.set(
        chiave,
        JSON.stringify({ idRiga: idDi(k), stato: "aperta", confermata: true, confermeAvvisi: [] }),
      );
    ultimo = await chiamate(w, idDi(k), "scheda-bbbb2222");
    maxSubs = Math.max(maxSubs, ultimo.subs);
  }
  const tutte = w.emesseSalvate();
  c(
    "dopo la conferma anche le 6 sono emesse: 100 fatture, numeri 1…100",
    Array.from({ length: 100 }, (_, i) => i + 1),
    tutte.map((f) => f.numero),
  );
  c(
    "l'ultima chiamata chiude il lotto da sola",
    [true, "emessa"],
    [ultimo.r.lottoChiuso, ultimo.r.esito],
  );
  c(
    "lotto chiuso: nessuna chiave bulk_fatture_ resta",
    0,
    [...w.m.keys()].filter((k) => k.startsWith("bulk_fatture_")).length,
  );
  c("lotto chiuso: il bucket è vuoto", 0, w.bucket.size);
  c("ogni chiamata, anche l'ultima con la chiusura, sotto le 40", true, maxSubs <= 40);
  console.log(
    `  info  massimo sottorichieste in una chiamata (con chiusura del lotto): ${maxSubs}`,
  );

  /* ══ 2. LA MISURA: 1.500 EMESSE FINTE ═════════════════════════════════ */
  gruppo("BULK · T12 · misura con 1.500 fatture emesse");
  {
    const wm = mondo(mod);
    for (let n = 1; n <= 1500; n++) {
      const f = {
        ...F.fatturaDaRiga({
          campi: {
            nome: nome(n + 200),
            cognome: cognome(n + 200),
            codiceFiscale: cfK(n + 200),
            indirizzo: `Via Prova ${n}`,
            cap: "00100",
            comune: "Roma",
            provincia: "RM",
            importo: 80 + (n % 40),
            data: "2026-11-01",
            modo: "bonifico",
            riferimento: `ALTRO${String(n).padStart(8, "0")}`,
          },
          azienda: AZIENDA,
          lotto: "lotto-vecchio",
          idRiga: idDi(n % 200),
          descrizione: "",
          leadId: null,
          numeroProvvisorio: n,
          impronte: [`x${n}`],
          adesso: "2026-11-01T10:00:00.000Z",
        }),
        id: `2026-${String(n).padStart(4, "0")}`,
        numero: n,
        origineBulk: {
          lotto: "lotto-vecchio",
          riga: `${String(n).padStart(4, "0")}`,
          impronte: [`x${n}`],
          riferimento: `ALTRO${String(n).padStart(8, "0")}`,
        },
      };
      wm.m.set(`fattura:${f.id}`, JSON.stringify(f));
    }
    semina(wm, mod, { clienti: [{ k: 0, opz: { data: "2026-11-05" } }] });
    const grezzi = [...wm.m].filter(([k]) => k.startsWith("fattura:")).map(([, v]) => v);
    const byte = grezzi.reduce((s, v) => s + v.length, 0);
    const p0 = performance.now();
    for (const v of grezzi) JSON.parse(v);
    const parse = performance.now() - p0;
    wm.reg.byteEmesse = 0;
    wm.reg.letteEmesse = 0;
    const t1 = performance.now();
    const { r, subs } = await chiamate(wm, idDi(0), "scheda-aaaa1111");
    const chiamata = performance.now() - t1;
    c(
      "con 1.500 emesse: la riga si emette (numero 1501) e il lotto si chiude",
      ["emessa", 1501, true],
      [r.esito, r.fattura?.numero, r.lottoChiuso],
    );
    c("con 1.500 emesse: sottorichieste ≤ 40", true, subs <= 40);
    c("con 1.500 emesse: una sola fattura in più", 1501, wm.emesseSalvate().length);
    console.log(
      `  MISURA  1.500 emesse = ${(byte / 1e6).toFixed(2)} MB (${Math.round(byte / 1500)} byte a fattura). ` +
        `Una chiamata di emissione le legge ${wm.reg.letteEmesse} volte (${(wm.reg.byteEmesse / 1e6).toFixed(2)} MB in tutto), ` +
        `parse di UNA lettura ${parse.toFixed(1)} ms, chiamata completa ${chiamata.toFixed(0)} ms di CPU di Node sul finto; ` +
        `${subs} sottorichieste: ${JSON.stringify(wm.reg.traccia)}`,
    );
  }

  /* ══ 3. RISPOSTA PERSA, RETE CADUTA DOPO LA SCRITTURA ═════════════════ */
  gruppo("BULK · T12 · risposta persa e rete caduta dopo la scrittura");
  {
    const wp = mondo(mod);
    semina(wp, mod, { clienti: [{ k: 0 }, { k: 1 }] });
    const a = await chiamate(wp, idDi(0), "scheda-aaaa1111");
    const b = await chiamate(wp, idDi(0), "scheda-aaaa1111");
    c(
      "la stessa riga due volte (risposta persa): la seconda è «emessa» con lo stesso numero",
      [1, 1, 1],
      [a.r.fattura.numero, b.r.fattura?.numero ?? b.r.codice, wp.emesseSalvate().length],
    );
    //  Rete caduta DOPO la fattura, mentre si chiude la riga: la fattura c'è, la risposta è «ferma».
    wp.rotte.sostituisciFallisceSu = /^bulk_fatture_r:/;
    const caduta = await chiamate(wp, idDi(1), "scheda-aaaa1111");
    c(
      "rete caduta dopo la scrittura: «ferma», e il messaggio dice che la fattura c'è",
      [true, true],
      [caduta.r.esito === "ferma", /è stata emessa/.test(caduta.r.messaggio)],
    );
    c("la fattura è stata scritta (2 in archivio)", 2, wp.emesseSalvate().length);
    const riga1 = JSON.parse(wp.m.get(kR(L, idDi(1))));
    c("la riga è ancora «aperta» nei dati (la chiusura non è passata)", "aperta", riga1.stato);
    const ripresa = await chiamate(wp, idDi(1), "scheda-aaaa1111");
    c(
      "la ripresa riconosce la riga: «emessa» con il numero 2, nessuna terza fattura",
      [ripresa.r.esito, ripresa.r.fattura?.numero, wp.emesseSalvate().length],
      ["emessa", 2, 2],
    );
    c(
      "la riga ora è chiusa e il lotto concluso",
      [true, 0],
      [ripresa.r.lottoChiuso, [...wp.m.keys()].filter((k) => k.startsWith("bulk_fatture_")).length],
    );
  }

  /* ══ 4. DUE SCHEDE ════════════════════════════════════════════════════ */
  gruppo("BULK · T12 · due schede, gare, «Prendi il controllo»");
  {
    const wd = mondo(mod);
    semina(wd, mod, {
      clienti: [0, 1, 2, 3].map((k) => ({ k, opz: { data: `2026-11-0${1 + k}` } })),
    });
    const A = "scheda-aaaa1111";
    const Bs = "scheda-bbbb2222";
    const r0 = await chiamate(wd, idDi(0), A);
    const rb = await chiamate(wd, idDi(1), Bs);
    c(
      "la seconda scheda mentre la prima è viva: «ferma» emittente_occupato",
      ["ferma", "emittente_occupato"],
      [rb.r.esito, rb.r.codice],
    );
    c("…e non nasce nessuna fattura da lei", 1, wd.emesseSalvate().length);
    const preso = await LK.prendiIlControllo(wd.porte.lucchetto, kE(L), Bs, 120_000, wd.ora);
    const rb2 = await chiamate(wd, idDi(1), Bs);
    c(
      "dopo «Prendi il controllo» la seconda passa",
      [true, "emessa", 2],
      [preso, rb2.r.esito, rb2.r.fattura?.numero],
    );
    const ra = await chiamate(wd, idDi(2), A);
    c(
      "e la prima, adesso, è rifiutata",
      ["ferma", "emittente_occupato"],
      [ra.r.esito, ra.r.codice],
    );
    c(
      "«Prendi il controllo» azzera il precedente: nessun salto segnalato",
      undefined,
      rb2.r.saltoDiNumeri,
    );
    void r0;

    //  Due chiamate insieme, due schede, due righe: una passa, l'altra no; mai due fatture con lo stesso numero.
    const wc = mondo(mod);
    semina(wc, mod, {
      clienti: [
        { k: 0, opz: { data: "2026-11-01" } },
        { k: 1, opz: { data: "2026-11-02" } },
      ],
    });
    wc.quando.dopoLettura = async (p) => {
      if (p === "bulk_fatture_f:" + L + ":") {
        wc.quando.dopoLettura = null;
        //  Nel mezzo della prima chiamata (lucchetto globale preso) arriva la seconda, con un altro emittente nuovo.
        wc.m.delete(kE(L)); // la seconda scheda ha «preso il controllo»: è lei l'emittente, ma il lucchetto globale è della prima
        wc.m.set(kE(L), JSON.stringify({ id: Bs, fino: new Date(wc.ora + 120_000).toISOString() }));
        wc.risposta2 = await S.emettiRiga(wc.porte, richiesta(idDi(1), Bs));
      }
    };
    const prima = await S.emettiRiga(wc.porte, richiesta(idDi(0), A));
    c(
      "seconda chiamata durante la prima: «ferma» lucchetto_occupato, nessuna fattura sua",
      ["ferma", "lucchetto_occupato", 1],
      [wc.risposta2?.esito, wc.risposta2?.codice, wc.emesseSalvate().length],
    );
    c(
      "la prima, che ha perso l'emittente a metà, scrive comunque la sua (era già dentro)",
      "emessa",
      prima.esito,
    );
    const libero = await wc.porte.lucchetto.leggi("bulk_fatture_lock");
    c("il lucchetto globale è sempre rilasciato", null, libero);

    //  Qualcuno emette in mezzo (altro programma, stesso archivio): il lotto prosegue, il salto è registrato.
    const wz = mondo(mod);
    semina(wz, mod, { clienti: [0, 1, 2].map((k) => ({ k, opz: { data: `2026-11-0${1 + k}` } })) });
    const z0 = await chiamate(wz, idDi(0), A);
    const estranea = {
      ...JSON.parse(wz.m.get("fattura:2026-0001")),
      id: "2026-0002",
      numero: 2,
      origineBulk: undefined,
      leadId: "altro",
    };
    wz.m.set("fattura:2026-0002", JSON.stringify(estranea));
    const z1 = await chiamate(wz, idDi(1), A);
    c(
      "qualcuno emette in mezzo: il lotto prosegue, numero 3 e salto {da 2, a 2} registrato",
      ["emessa", 3, { da: 2, a: 2 }],
      [z1.r.esito, z1.r.fattura?.numero, z1.r.saltoDiNumeri],
    );
    const z2 = await chiamate(wz, idDi(2), A);
    c(
      "la riga dopo: numero 4, nessun salto",
      [4, undefined],
      [z2.r.fattura?.numero, z2.r.saltoDiNumeri],
    );
    c(
      "l'archivio ha 1, 2, 3, 4 senza buchi",
      [1, 2, 3, 4],
      wz.emesseSalvate().map((f) => f.numero),
    );
    void z0;
  }

  /* ══ 5. IMPOSTAZIONI CAMBIATE ═════════════════════════════════════════ */
  gruppo("BULK · T12 · impostazioni cambiate a metà");
  {
    const wi = mondo(mod);
    semina(wi, mod, { clienti: [0, 1, 2].map((k) => ({ k, opz: { data: `2026-11-0${1 + k}` } })) });
    const i0 = await chiamate(wi, idDi(0), "scheda-aaaa1111");
    wi.azienda({ aliquotaPredefinita: 4 });
    const i1 = await chiamate(wi, idDi(1), "scheda-aaaa1111");
    c(
      "aliquota cambiata: «ferma» impostazioni_cambiate",
      ["emessa", "ferma", "impostazioni_cambiate"],
      [i0.r.esito, i1.r.esito, i1.r.codice],
    );
    c("nessuna fattura in più", 1, wi.emesseSalvate().length);
    //  Cambia mentre si leggono le fatture (dopo l'inizio della chiamata, prima del controllo finale): ferma, nulla scritto.
    const wj = mondo(mod);
    semina(wj, mod, { clienti: [{ k: 0 }] });
    wj.quando.dopoLettura = async (p) => {
      if (p === "fattura_bozza:") wj.azienda({ serie: "A" });
    };
    const j0 = await chiamate(wj, idDi(0), "scheda-aaaa1111");
    c(
      "cambiata durante la chiamata, prima della valutazione: «ferma», nessuna fattura",
      ["ferma", "impostazioni_cambiate", 0],
      [j0.r.esito, j0.r.codice, wj.emesseSalvate().length],
    );
    //  Il centro non va più bene per lo SdI (P.IVA sbagliata), con la stessa firma: controllaLotto lo ferma.
    const wk = mondo(mod);
    semina(wk, mod, { clienti: [{ k: 0 }] });
    wk.azienda({ partitaIva: "12345670018" });
    const k0 = await chiamate(wk, idDi(0), "scheda-aaaa1111");
    c(
      "P.IVA non valida (firma uguale): controllaLotto ferma il lotto",
      ["ferma", "impostazioni_cambiate", 0],
      [k0.r.esito, k0.r.codice, wk.emesseSalvate().length],
    );
  }

  /* ══ 6. SCHEDE, DOPPIONI, SCARTO ══════════════════════════════════════ */
  gruppo("BULK · T12 · scheda, doppioni e righe che non partono");
  {
    const ws = mondo(mod);
    ws.schede = [
      {
        id: "scheda-xyz-1",
        nome: nome(0),
        cognome: cognome(0),
        codiceFiscale: cfK(0),
        telefono: "331000000",
      },
    ];
    semina(ws, mod, {
      clienti: [
        { k: 0, opz: { data: "2026-11-01" } },
        {
          k: 1,
          opz: { data: "2026-11-02" },
          decisioni: { confermata: true, confermeAvvisi: [], scheda: "scheda-che-non-esiste" },
        },
        {
          k: 2,
          opz: { data: "2026-11-03" },
          decisioni: { confermata: true, confermeAvvisi: [], scheda: "scheda-xyz-1" },
        },
      ],
    });
    const s0 = await chiamate(ws, idDi(0), "scheda-aaaa1111");
    c(
      "abbinamento automatico per CF: la fattura porta la scheda come leadId",
      "scheda-xyz-1",
      ws.emesseSalvate()[0]?.leadId,
    );
    const s1 = await chiamate(ws, idDi(1), "scheda-aaaa1111");
    c(
      "scheda scelta a mano che non esiste → saltata, nessuna fattura",
      ["saltata", "scheda_non_trovata", 1],
      [
        s1.r.esito,
        s1.r.motivi?.some((m) => m.codice === "scheda_non_trovata") && "scheda_non_trovata",
        ws.emesseSalvate().length,
      ],
    );
    const s2 = await chiamate(ws, idDi(2), "scheda-aaaa1111");
    c(
      "scheda scelta a mano con CF di un'altra persona → chiede conferma, non parte",
      ["saltata", true],
      [s2.r.esito, s2.r.motivi?.some((m) => m.codice === "scheda_cf_diverso")],
    );
    void s0;
    //  I motivi del server sono quelli dell'anteprima: stessa funzione.
    const V = mod["fatture/bulk/valuta"];
    void V;

    //  Doppioni fra righe del lotto: lo stesso CRO su due righe, nessuna delle due parte.
    const wdop = mondo(mod);
    semina(wdop, mod, {
      clienti: [
        { k: 0, opz: { riferimento: "CRO99999999" } },
        { k: 1, opz: { riferimento: "CRO99999999" } },
      ],
    });
    const d0 = await chiamate(wdop, idDi(0), "scheda-aaaa1111");
    c(
      "stesso CRO su due righe: nessuna parte (la riga vede le altre)",
      ["saltata", true, 0],
      [
        d0.r.esito,
        d0.r.motivi?.some((m) => m.codice === "doppione_riferimento"),
        wdop.emesseSalvate().length,
      ],
    );
    //  La riga già fatturata con quell'origine, ma con decisione ancora «aperta»: non si rifa.
    const wo = mondo(mod);
    semina(wo, mod, { clienti: [{ k: 0 }] });
    await chiamate(wo, idDi(0), "scheda-aaaa1111");
    wo.m.set(
      kT(L),
      JSON.stringify({
        lotto: L,
        creatoIl: new Date(T0).toISOString(),
        descrizione: "",
        dataSeManca: "",
        firmaImpostazioni: wo.firma(),
      }),
    );
    semina(wo, mod, { clienti: [{ k: 0 }] });
    const o1 = await chiamate(wo, idDi(0), "scheda-aaaa1111");
    c(
      "fattura già emessa, riga ancora aperta (altra scheda): si chiude, non si rifà",
      ["emessa", 1],
      [o1.r.esito, wo.emesseSalvate().length],
    );
    //  Una riga perfetta ma non confermata: «saltata» con un motivo che dice di confermarla.
    const wn = mondo(mod);
    semina(wn, mod, { clienti: [{ k: 0, decisioni: null }] });
    const n0 = await chiamate(wn, idDi(0), "scheda-aaaa1111");
    c(
      "riga pronta ma non confermata → saltata non_confermata, nessuna fattura",
      ["saltata", "non_confermata", 0],
      [n0.r.esito, n0.r.motivi?.[0]?.codice, wn.emesseSalvate().length],
    );
    //  Corretta DOPO la conferma (la conferma si toglie): non parte.
    const wm2 = mondo(mod);
    semina(wm2, mod, {
      clienti: [
        { k: 0, decisioni: { confermata: false, confermeAvvisi: [], modifiche: { cap: "20121" } } },
      ],
    });
    const n1 = await chiamate(wm2, idDi(0), "scheda-aaaa1111");
    c(
      "riga modificata dopo la conferma (conferma tolta) → saltata",
      ["saltata", 0],
      [n1.r.esito, wm2.emesseSalvate().length],
    );
    //  Riga scartata: non si emette. Riga inesistente: saltata. Lotto inesistente: ferma.
    const wr = mondo(mod);
    semina(wr, mod, {
      clienti: [{ k: 0, decisioni: { confermata: true, confermeAvvisi: [] } }, { k: 1 }],
    });
    wr.m.set(kR(L, idDi(0)), JSON.stringify({ idRiga: idDi(0), stato: "scartata" }));
    const r0 = await chiamate(wr, idDi(0), "scheda-aaaa1111");
    c("riga scartata → saltata", ["saltata", "riga_scartata"], [r0.r.esito, r0.r.motivi[0].codice]);
    const r9 = await chiamate(wr, idDi(5), "scheda-aaaa1111");
    c(
      "riga che non c'è → saltata",
      ["saltata", "riga_non_trovata"],
      [r9.r.esito, r9.r.motivi[0].codice],
    );
    //  Un gruppo la cui lettura è fallita (tre file in errore, tipo vuoto) è una riga: non si emette, ma NON è «non trovata».
    const wf = mondo(mod);
    semina(wf, mod, { clienti: [{ k: 0 }, { k: 1 }] });
    for (let i = 6; i < 9; i += 1)
      wf.m.set(kF(L, i), JSON.stringify({ indice: i, stato: "errore", impronta: `e${i}`, tipo: "", errore: "illeggibile" }));
    const rf = await chiamate(wf, idDi(2), "scheda-aaaa1111");
    c(
      "riga con la lettura fallita → saltata ma trovata (non «riga_non_trovata»), nessuna fattura",
      ["saltata", false, 0],
      [rf.r.esito, rf.r.motivi.some((m) => m.codice === "riga_non_trovata"), wf.emesseSalvate().length],
    );
    const rx = await chiamate(wr, idDi(0), "scheda-aaaa1111", L2);
    c("lotto che non c'è → ferma non_trovato", ["ferma", "non_trovato"], [rx.r.esito, rx.r.codice]);
    const r1 = await chiamate(wr, idDi(1), "scheda-aaaa1111");
    c(
      "l'ultima riga aperta emessa con l'altra scartata → il lotto si chiude",
      [true, 0],
      [r1.r.lottoChiuso, [...wr.m.keys()].filter((k) => k.startsWith("bulk_fatture_")).length],
    );
  }

  /* ══ 7. LE FOTO: RIMOZIONE CHE FALLISCE, RITENTATA ════════════════════ */
  gruppo("BULK · T12 · foto tolte subito, e ritentate se la rimozione fallisce");
  {
    const wf = mondo(mod);
    semina(wf, mod, { clienti: [0, 1, 2].map((k) => ({ k, opz: { data: `2026-11-0${1 + k}` } })) });
    const f0 = await chiamate(wf, idDi(0), "scheda-aaaa1111");
    c(
      "a emissione fatta le 3 foto della riga non ci sono più, ne restano 6",
      [6, true],
      [wf.bucket.size, f0.r.esito === "emessa"],
    );
    //  La rimozione fallisce UNA volta: il ritentativo nella stessa chiamata la porta a termine.
    wf.rotte.rimuoviFallisce = 1;
    const f1 = await chiamate(wf, idDi(1), "scheda-aaaa1111");
    c(
      "rimozione fallita una volta: la riga resta emessa e le foto vengono tolte al secondo colpo",
      ["emessa", 3],
      [f1.r.esito, wf.bucket.size],
    );
    //  Fallisce due volte: restano orfane, la riga è emessa; la chiamata dopo le toglie.
    const wg = mondo(mod);
    semina(wg, mod, { clienti: [0, 1].map((k) => ({ k, opz: { data: `2026-11-0${1 + k}` } })) });
    wg.rotte.rimuoviFallisce = 2;
    const g0 = await chiamate(wg, idDi(0), "scheda-aaaa1111");
    c(
      "rimozione fallita due volte: «emessa» lo stesso, 6 foto nel bucket",
      ["emessa", 6],
      [g0.r.esito, wg.bucket.size],
    );
    c("…e l'avviso è nel log (solo codice)", true, wg.reg.log.includes("rimozione_file_fallita"));
    const g1 = await chiamate(wg, idDi(1), "scheda-aaaa1111");
    c(
      "la chiamata dopo toglie le orfane (e il lotto si chiude)",
      [0, true],
      [wg.bucket.size, g1.r.lottoChiuso],
    );
  }

  /* ══ 7b. LE PORTE COME IN PRODUZIONE ═════════════════════════════════ */
  gruppo(
    "BULK · T12 · porte avvolte come nella rotta (archivioSoloBulk e archivio dell'emissione)",
  );
  {
    const wa = mondo(mod);
    const P = wa.porte;
    const ok = { stato: "creata" };
    const rifiuto = { stato: "errore", errore: "chiave fuori dal bulk: non ammessa" };
    c(
      "l'archivio delle azioni (archivioSoloBulk) rifiuta di creare fattura:*",
      rifiuto,
      await P.archivio.creaSeAssente("fattura:2026-0001", "{}"),
    );
    c(
      "l'archivio dell'emissione crea fattura:*",
      ok,
      await P.archivioEmissione.creaSeAssente("fattura:2026-0001", "{}"),
    );
    c(
      "…ma non una bozza",
      "errore",
      (await P.archivioEmissione.creaSeAssente("fattura_bozza:x", "{}")).stato,
    );
    c(
      "…ma non una chiave qualunque",
      "errore",
      (await P.archivioEmissione.creaSeAssente("fattura_azienda", "{}")).stato,
    );
    const nega = (r) => typeof r === "string" && r.length > 0;
    c(
      "scrivi e elimina su fattura:* e fattura_bozza:* rifiutati, in tutti e due gli archivi",
      [true, true, true, true, true, true, true, true],
      [
        await P.archivio.scrivi("fattura:2026-0001", "{}"),
        await P.archivio.elimina("fattura:2026-0001"),
        await P.archivio.scrivi("fattura_bozza:x", "{}"),
        await P.archivio.elimina("fattura_bozza:x"),
        await P.archivioEmissione.scrivi("fattura:2026-0001", "{}"),
        await P.archivioEmissione.elimina("fattura:2026-0001"),
        await P.archivioEmissione.scrivi("fattura_bozza:x", "{}"),
        await P.archivioEmissione.eliminaPerPrefisso("fattura:"),
      ].map(nega),
    );
    c(
      "nel finto non è cambiato niente oltre alla creazione ammessa",
      [["fattura:2026-0001"], []],
      [[...wa.m.keys()].filter((k) => k.startsWith("fattura:")), wa.reg.vietate],
    );
    //  Una intera emissione con le porte avvolte: scrive solo con creaSeAssente su fattura:*, mai altro fuori dal bulk.
    const wb = mondo(mod);
    semina(wb, mod, { clienti: [0, 1].map((k) => ({ k, opz: { data: `2026-11-0${1 + k}` } })) });
    const e0 = await chiamate(wb, idDi(0), "scheda-aaaa1111");
    c(
      "con le porte avvolte la fattura nasce",
      ["emessa", 1],
      [e0.r.esito, wb.emesseSalvate().length],
    );
    c("…e nessuna scrittura o cancellazione fuori dal bulk (bozze comprese)", [], wb.reg.vietate);
  }

  /* ══ 7c. L'ULTIMA RIGA CON LA RISPOSTA PERSA ══════════════════════════ */
  gruppo("BULK · T12 · risposta persa dell'ultima riga: il lotto non c'è più");
  {
    const wl = mondo(mod);
    semina(wl, mod, { clienti: [{ k: 0 }] });
    const prima = await chiamate(wl, idDi(0), "scheda-aaaa1111");
    c(
      "l'ultima riga si emette e chiude il lotto",
      [true, false],
      [prima.r.lottoChiuso, wl.m.has(kT(L))],
    );
    const seconda = await chiamate(wl, idDi(0), "scheda-aaaa1111");
    c(
      "risposta persa: la seconda chiamata dà la STESSA fattura, lotto chiuso",
      [prima.r.fattura, true, 1],
      [seconda.r.fattura, seconda.r.lottoChiuso, wl.emesseSalvate().length],
    );
    c(
      "…con una sola lettura di fattura:, senza lucchetto né scritture",
      [1, false, false, false],
      [
        wl.reg.traccia["pagine fattura"],
        "lucchetto.crea" in wl.reg.traccia,
        "archivio.scrivi" in wl.reg.traccia,
        wl.m.has("bulk_fatture_lock"),
      ],
    );
    const altra = await chiamate(wl, idDi(3), "scheda-aaaa1111");
    c(
      "un'altra riga di un lotto che non c'è → ferma non_trovato",
      ["ferma", "non_trovato"],
      [altra.r.esito, altra.r.codice],
    );
  }

  /* ══ 7d. RINNOVO DELL'EMITTENTE CHE CADE DOPO LA FATTURA ══════════════ */
  gruppo("BULK · T12 · rete caduta sul rinnovo dopo la fattura");
  {
    const wr = mondo(mod);
    semina(wr, mod, { clienti: [0, 1].map((k) => ({ k, opz: { data: `2026-11-0${1 + k}` } })) });
    wr.quando.primaDiSostituire = async (k) => {
      if (/^bulk_fatture_e:/.test(k) && wr.emesseSalvate().length > 0)
        throw new Error("rete caduta (finta)");
    };
    const r0 = await chiamate(wr, idDi(0), "scheda-aaaa1111");
    c(
      "rinnovo che lancia dopo la fattura: la risposta resta «emessa»",
      ["emessa", 1],
      [r0.r.esito, r0.r.fattura?.numero],
    );
    c(
      "…la riga è chiusa e il log dice solo il codice",
      ["emessa", true],
      [JSON.parse(wr.m.get(kR(L, idDi(0)))).stato, wr.reg.log.includes("emittente_perso")],
    );
  }

  /* ══ 7e. CHIUSURA DEI FILE INTERROTTA A METÀ ══════════════════════════ */
  gruppo(
    "BULK · T12 · la riduzione dei file si interrompe dopo chiudiRiga: la ripresa la completa",
  );
  {
    const wz = mondo(mod);
    semina(wz, mod, { clienti: [0, 1].map((k) => ({ k, opz: { data: `2026-11-0${1 + k}` } })) });
    //  La scrittura del primo file della riga fallisce (anche alla ripetizione): la riga è già `emessa` nei dati.
    wz.rotte.scriviFallisce = { re: /^bulk_fatture_f:/, volte: 2 };
    const z0 = await chiamate(wz, idDi(0), "scheda-aaaa1111");
    const f0 = JSON.parse(wz.m.get(kF(L, 0)));
    c(
      "scrittura dei file fallita: «ferma», fattura scritta, riga emessa ma file non ridotti",
      ["ferma", 1, "emessa", true],
      [
        z0.r.esito,
        wz.emesseSalvate().length,
        JSON.parse(wz.m.get(kR(L, idDi(0)))).stato,
        "lettura" in f0,
      ],
    );
    const z1 = await chiamate(wz, idDi(0), "scheda-aaaa1111");
    const ridotti = [0, 1, 2].map((i) => JSON.parse(wz.m.get(kF(L, i))));
    c(
      "la ripresa riduce i file (niente lettura, niente percorso, stato emessa) e risponde «emessa» con lo stesso numero",
      ["emessa", 1, true, 1],
      [
        z1.r.esito,
        z1.r.fattura?.numero,
        ridotti.every((f) => f.stato === "emessa" && !("lettura" in f) && !("percorso" in f)),
        wz.emesseSalvate().length,
      ],
    );
    c(
      "…e le 3 foto di quella riga non sono più nel bucket (restano le 3 dell'altra)",
      3,
      wz.bucket.size,
    );
  }

  /* ══ 7f. LO STESSO PAGAMENTO IN DUE LOTTI ═════════════════════════════ */
  gruppo(
    "BULK · T12 · stesso screenshot di pagamento in due lotti (regge impronteAltriLotti vuoto)",
  );
  {
    //  Stessa impronta del file di pagamento (indice 2), tutto il resto diverso: l'unico legame è la foto.
    const diversa = { riferimento: "CRO55555555", importo: 333, data: "2026-11-08" };
    const wq = mondo(mod);
    semina(wq, mod, {
      lotto: L,
      clienti: [
        { k: 0, opz: { data: "2026-11-01" } },
        { k: 1, opz: { data: "2026-11-02" } },
      ],
    });
    semina(wq, mod, { lotto: L2, clienti: [{ k: 0, opz: diversa }] });
    const a = await chiamate(wq, idDi(0), "scheda-aaaa1111", L);
    const b = await chiamate(wq, idDi(0), "scheda-bbbb2222", L2);
    c(
      "due lotti aperti: la prima emette, la seconda è «saltata» con doppione_screenshot",
      ["emessa", "saltata", true, 1],
      [
        a.r.esito,
        b.r.esito,
        b.r.motivi?.some((m) => m.codice === "doppione_screenshot"),
        wq.emesseSalvate().length,
      ],
    );
    //  D11b: il lotto si chiude ed è cancellato; un lotto nuovo con lo stesso screenshot è fermato lo stesso.
    const wd = mondo(mod);
    semina(wd, mod, { lotto: L, clienti: [{ k: 0, opz: { data: "2026-11-01" } }] });
    const d0 = await chiamate(wd, idDi(0), "scheda-aaaa1111", L);
    semina(wd, mod, { lotto: L2, clienti: [{ k: 0, opz: diversa }] });
    const d1 = await chiamate(wd, idDi(0), "scheda-aaaa1111", L2);
    c(
      "D11b: lotto concluso ed eliminato, nuovo lotto con lo stesso screenshot → bloccata",
      [true, "saltata", true, 1],
      [
        d0.r.lottoChiuso,
        d1.r.esito,
        d1.r.motivi?.some((m) => m.codice === "doppione_screenshot"),
        wd.emesseSalvate().length,
      ],
    );
  }

  /* ══ 8. PROVA DI SORGENTE ═════════════════════════════════════════════ */
  gruppo("BULK · T12 · prova di sorgente");
  {
    const src = readFileSync(join(radice, "src/crm/fatture/bulk/emissione.server.ts"), "utf8");
    const codice = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    c("nessun console. in emissione.server.ts", false, /console\./.test(codice));
    c(
      "la riga si chiude con chiudiRiga (mai una scrittura a mano)",
      [true, false, false],
      [
        /chiudiRiga\(/.test(codice),
        /archivio\.scrivi\(|archivio\.elimina\(/.test(codice),
        /bulk_fatture_r/.test(codice),
      ],
    );
    c(
      "valuta con valutaRigaNelLotto, mai con valutaRiga",
      [true, false],
      [/valutaRigaNelLotto\(/.test(codice), /\bvalutaRiga\(/.test(codice)],
    );
    c(
      "cercaPerOrigine, controllaLotto ed emettiProtettoSu sono usati",
      [true, true, true],
      [
        /cercaPerOrigine\(/.test(codice),
        /controllaLotto\(/.test(codice),
        /emettiProtettoSu\(/.test(codice),
      ],
    );
    c(
      "nessuna chiave o password nel sorgente",
      false,
      /(sk-[A-Za-z0-9]{10,}|service_role|eyJ[A-Za-z0-9_-]{20,})/.test(src),
    );
  }
}
