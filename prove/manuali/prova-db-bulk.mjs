/** ── PROVA SUL DATABASE VERO · FATTURE BULK (T15) ─────────────────────────────
 *  La lancia SOLO il titolare, dal suo terminale. Nessun agente e nessuno sviluppatore la lancia
 *  contro il database vero, e nessuno riceve la chiave.
 *
 *  ── COME SI LANCIA (dalla cartella del progetto) ──────────────────────────────
 *    read -rs SUPABASE_SERVICE_ROLE_KEY && export SUPABASE_SERVICE_ROLE_KEY
 *    node prove/manuali/prova-db-bulk.mjs
 *    unset SUPABASE_SERVICE_ROLE_KEY
 *
 *  `read -rs` non mostra quello che incolli e non lo mette nella cronologia. La chiave NON va scritta
 *  in un file, in `.env`, in chat, né dopo il nome dello script (finirebbe nella cronologia e in `ps`).
 *  L'indirizzo del progetto non va dato: lo prende da `supabase/config.toml` (project_id).
 *
 *  ── COSA FA ───────────────────────────────────────────────────────────────────
 *  1. Si ferma, prima di ogni richiesta, se: manca la chiave; il progetto del file di configurazione
 *     non è ben formato; `SUPABASE_URL` (se la hai) non è quello del progetto; la chiave è di un altro
 *     progetto o non è una chiave di servizio.
 *  2. Controlla che non esista già nessuna riga `bulk_fatture_prova:*`; se c'è, si ferma senza toccarla.
 *  3. Scrive 1.200 righe finte e prova: l'inserimento doppio (il codice di errore vero, atteso 23505,
 *     è quello su cui si regge `creaSeAssente` di archivio.ts), il tetto di righe per risposta, la
 *     lettura paginata per chiave oltre 1000 righe (con inserimenti in corso) fatta dalla STESSA
 *     funzione dell'emissione (`leggiPrefissoPerChiave` di emissione-bulk.ts), `leggiMolte` con
 *     chiavi lunghe, e in sola lettura la query della porta schede su `crm_leads`.
 *  4. Qualunque cosa succeda (`finally`) cancella con `eliminaPerPrefisso` tutte le righe di prova e
 *     conta quelle rimaste: devono essere zero.
 *
 *  ── COSA NON FA ───────────────────────────────────────────────────────────────
 *  Non tocca `fattura:*`, `fattura_bozza:*`, `fattura_azienda`, `bulk_fatture_lock` né altre chiavi;
 *  su `crm_leads` NON scrive. Ogni richiesta passa da `guarda()`, che rifiuta qualunque chiave non
 *  inizi con `bulk_fatture_prova:` e qualunque tabella diversa da `app_config` e `crm_leads`.
 *  Non stampa la chiave né la scrive; stampa solo codici di errore, conteggi e tempi (nessun testo
 *  di risposta, nessun dato personale: delle schede si contano righe e si guarda la forma).
 *
 *  Esce con 0 se tutto è andato bene e non resta nulla; 1 se una prova è fallita o è rimasto
 *  qualcosa; 2 se si è fermato per una guardia prima di scrivere. Incolla in lavagna l'output intero. */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/* ═══════════════════════════════════════════════════════════════════════════
   1. LA GUARDIA SULLE CHIAVI
   ═════════════════════════════════════════════════════════════════════════ */

/** ⚠️ Il solo prefisso che questo script può scrivere, leggere e cancellare. Costante: mai una variabile. */
const PREFISSO = "bulk_fatture_prova:";
/** Lo stesso prefisso nella forma per `LIKE` (il «_» è un jolly se non lo si protegge). */
const PREFISSO_LIKE = "bulk\\_fatture\\_prova:";
/** Per il titolare, se restano righe di prova (prova interrotta o pulizia non riuscita). */
const SQL_PULIZIA = "delete from app_config where key like 'bulk\\_fatture\\_prova:%';";

/** UNICA funzione che dà il permesso a una chiave: rifiuta tutto ciò che non inizia con `PREFISSO`
 *  (compreso il solo prefisso e i caratteri strani). Ogni chiave dello script ci passa dentro, e
 *  `guarda()` la richiama su ogni richiesta, anche quelle del codice di emissione importato. */
export function chiaveProva(k) {
  if (
    typeof k !== "string" ||
    !k.startsWith(PREFISSO) ||
    !/^[A-Za-z0-9_:.-]+$/.test(k.slice(PREFISSO.length))
  )
    throw new Error("chiave fuori dalla prova: rifiutata");
  return k;
}

const modelloProva = (v) => typeof v === "string" && v.startsWith(PREFISSO_LIKE);
const rifiuta = (cosa) => {
  throw new Error(`operazione non ammessa: ${cosa}`);
};

/** Il client che vede tutto il resto dello script. Espone solo: su `app_config` letture/scritture/cancellazioni
 *  limitate al prefisso di prova; su `crm_leads` la sola `select`. Non c'è modo di arrivare alla tabella
 *  senza un filtro sul prefisso (la `select` iniziale non è attendibile da sola). */
export function guarda(client) {
  return {
    from(tabella) {
      if (tabella === "app_config")
        return {
          select: (colonne, opzioni) => {
            const q = () => client.from("app_config").select(colonne, opzioni);
            return {
              like: (k, v) => {
                if (k !== "key" || !modelloProva(v)) rifiuta("lettura fuori dal prefisso");
                return q().like(k, v);
              },
              in: (k, valori) => {
                if (k !== "key" || !Array.isArray(valori)) rifiuta("lettura per chiavi");
                valori.forEach(chiaveProva);
                return q().in(k, valori);
              },
              eq: (k, v) => {
                if (k !== "key") rifiuta("lettura per colonna");
                chiaveProva(v);
                return q().eq(k, v);
              },
            };
          },
          insert: (righe) => {
            for (const r of [].concat(righe)) {
              chiaveProva(r?.key);
              if (Object.keys(r).some((c) => c !== "key" && c !== "value")) rifiuta("colonna extra");
            }
            return client.from("app_config").insert(righe);
          },
          delete: () => ({
            like: (k, v) => {
              if (k !== "key" || !modelloProva(v)) rifiuta("cancellazione fuori dal prefisso");
              return client.from("app_config").delete().like(k, v);
            },
          }),
        };
      //  Sola lettura: la `select` torna un costruttore di interrogazioni che non sa scrivere.
      if (tabella === "crm_leads") return { select: (c) => client.from("crm_leads").select(c) };
      return rifiuta("tabella");
    },
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   2. LE GUARDIE PRIMA DI PARTIRE (nessuna richiesta di rete)
   ═════════════════════════════════════════════════════════════════════════ */

/** `project_id` di supabase/config.toml: l'unica fonte dell'indirizzo. */
function progettoDaConfig(radice, leggi) {
  const testo = leggi(join(radice, "supabase/config.toml"));
  const m = /^\s*project_id\s*=\s*"([a-z0-9]{20})"\s*$/m.exec(testo);
  return m ? m[1] : null;
}

/** Legge, senza verificarla, la parte centrale di una chiave in formato JWT. Torna null se non lo è. */
function carichiDellaChiave(chiave) {
  const parti = chiave.split(".");
  if (parti.length !== 3) return null;
  try {
    return JSON.parse(Buffer.from(parti[1], "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

/** Torna `{ url }` oppure `{ fermo: "motivo" }`. Il motivo non contiene mai la chiave. */
export function controllaPartenza({ env, argv, radice, leggi }) {
  if (argv.length > 0)
    return { fermo: "non si danno argomenti allo script (la chiave non va scritta nel comando)" };
  const chiave = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!chiave)
    return {
      fermo:
        "manca SUPABASE_SERVICE_ROLE_KEY. Prima: read -rs SUPABASE_SERVICE_ROLE_KEY && export SUPABASE_SERVICE_ROLE_KEY",
    };
  let progetto = null;
  try {
    progetto = progettoDaConfig(radice, leggi);
  } catch {
    /* resta null */
  }
  if (!progetto) return { fermo: "supabase/config.toml non ha un project_id leggibile" };
  const url = `https://${progetto}.supabase.co`;
  if (env.SUPABASE_URL && env.SUPABASE_URL.replace(/\/+$/, "") !== url)
    return { fermo: "SUPABASE_URL non è l'indirizzo del progetto di supabase/config.toml" };
  const carichi = carichiDellaChiave(chiave);
  if (carichi) {
    if (carichi.role !== "service_role")
      return { fermo: "la chiave non è una chiave di servizio (service_role)" };
    if (carichi.ref !== progetto)
      return { fermo: "la chiave è di un altro progetto rispetto a supabase/config.toml" };
  } else if (!chiave.startsWith("sb_secret_"))
    return { fermo: "formato della chiave non riconosciuto: serve la chiave di servizio" };
  return { url, progetto };
}

/* ═══════════════════════════════════════════════════════════════════════════
   3. IL CODICE DI EMISSIONE VERO, SENZA CLIENT
   ═════════════════════════════════════════════════════════════════════════ */

/** Impacchetta in memoria `emissione-bulk.ts` (lo stesso file che usa l'emissione) per usare le sue
 *  funzioni vere: lettura paginata, `creaSeAssente`, `eliminaPerPrefisso`. Il client del browser è
 *  sostituito da uno vuoto: il modulo non può arrivare a nessun database se non gli si passa il nostro. */
async function caricaEmissione(radice) {
  const esbuild = createRequire(import.meta.url)("esbuild");
  const senzaClient = {
    name: "senza-client",
    setup(b) {
      b.onResolve({ filter: /^@\/integrations\/supabase\/client$/ }, (a) => ({
        path: a.path,
        namespace: "finto",
      }));
      b.onLoad({ filter: /.*/, namespace: "finto" }, () => ({
        contents: "export const supabase = {};",
        loader: "js",
      }));
    },
  };
  const r = await esbuild.build({
    entryPoints: [join(radice, "src/crm/fatture/bulk/emissione-bulk.ts")],
    bundle: true,
    write: false,
    format: "esm",
    platform: "node",
    absWorkingDir: radice,
    alias: { "@": "./src" },
    loader: { ".tsx": "tsx" },
    plugins: [senzaClient],
    logLevel: "silent",
  });
  return import(`data:text/javascript;base64,${Buffer.from(r.outputFiles[0].text).toString("base64")}`);
}

async function clienteVero(url, chiave) {
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(url, chiave, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   4. LA PROVA
   ═════════════════════════════════════════════════════════════════════════ */

const PAGINA_SCHEDE = 1000;
const MAX_PAGINE_SCHEDE = 2; // shortcut: per la sola forma bastano 2 pagine da 1000; il CRM intero non si legge
const CAMPI_SCHEDA = ["id", "nome", "cognome", "codiceFiscale", "telefono"];

/** Un errore da cui esce solo un codice: il testo delle risposte non si stampa. */
class ErroreCodice extends Error {
  constructor(codice, stato) {
    super("errore");
    this.codice = codice ?? "senza_codice";
    this.stato = stato ?? null;
  }
}
const descrivi = (e) =>
  e instanceof ErroreCodice
    ? `codice=${e.codice}${e.stato ? ` stato=${e.stato}` : ""}`
    : `eccezione=${e?.name ?? "?"} (messaggio non mostrato)`;

async function contaPrefisso(client) {
  const { count, error, status } = await client
    .from("app_config")
    .select("key", { count: "exact", head: true })
    .like("key", `${PREFISSO_LIKE}%`);
  if (error) throw new ErroreCodice(error.code, status);
  return count; // può essere null: significa «sconosciuto», non zero
}

const pad = (n, l = 4) => String(n).padStart(l, "0");

export async function esegui(dip) {
  const stampa = dip.stampa ?? ((s) => console.log(s));
  const ora = dip.ora ?? (() => performance.now());
  const esiti = [];
  const prova = async (nome, fn) => {
    const t0 = ora();
    let ok = false;
    let info;
    try {
      [ok, info] = await fn();
    } catch (e) {
      info = descrivi(e);
    }
    esiti.push(ok);
    stampa(`${ok ? "OK  " : "NO  "} ${nome}: ${info} (${Math.round(ora() - t0)} ms)`);
  };
  const fermo = (motivo) => {
    stampa(`FERMO prima di scrivere: ${motivo}`);
    return 2;
  };

  const partenza = controllaPartenza({
    env: dip.env,
    argv: dip.argv ?? [],
    radice: dip.radice,
    leggi: dip.leggi ?? ((p) => readFileSync(p, "utf8")),
  });
  if (partenza.fermo) return fermo(partenza.fermo);
  stampa(`Guardie di partenza: ok (chiave presente e non mostrata, chiave di servizio). Progetto su cui scrivo: ${partenza.progetto}`);

  //  Da qui il client passa sempre da `guarda`, anche per il codice di emissione.
  const client = guarda(await (dip.creaClient ?? clienteVero)(partenza.url, dip.env.SUPABASE_SERVICE_ROLE_KEY));
  const emissione = await (dip.caricaEmissione ?? caricaEmissione)(dip.radice);
  const archivio = emissione.archivioProtettoSu(client);

  //  Non si parte se c'è già qualcosa col prefisso: o è una prova interrotta, o non è roba nostra.
  let gia;
  try {
    gia = await contaPrefisso(client);
  } catch (e) {
    return fermo(`prima lettura non riuscita (${descrivi(e)}): chiave rifiutata o rete`);
  }
  if (gia === null) return fermo("il conteggio iniziale delle righe di prova è sconosciuto: non scrivo");
  if (gia > 0)
    return fermo(
      `esistono già ${gia} righe con il prefisso di prova: non le tocco. Se sono di una prova interrotta, nel pannello SQL di Supabase: ${SQL_PULIZIA}`,
    );
  stampa("Controllo iniziale: nessuna riga di prova presente");

  const lotto = randomUUID();
  //  Chiavi lunghe come quelle vere del bulk (~75 caratteri): serve anche a misurare `leggiMolte`.
  const chiaveRiga = (i, coda = "xxxxxxxxxxxxxx") =>
    chiaveProva(`${PREFISSO}r:${lotto}:riga-${pad(i)}-${coda}`);
  const chiaveDoppia = chiaveProva(`${PREFISSO}doppio:${lotto}`);
  const N = 1200;
  const EXTRA = 30;
  const extra = Array.from({ length: EXTRA }, (_, i) => ({
    key: chiaveRiga(990 + (i % 20), `extra-${pad(i, 2)}`),
    value: "{}",
  }));
  let iniziato = false;
  try {
    iniziato = true; // da qui, in ogni caso, si pulisce
    await prova(`inserimento di ${N} righe finte (a gruppi di 200)`, async () => {
      for (let da = 0; da < N; da += 200) {
        const righe = Array.from({ length: 200 }, (_, j) => ({
          key: chiaveRiga(da + j),
          value: JSON.stringify({ prova: true, n: da + j }),
        }));
        const { error, status } = await client.from("app_config").insert(righe);
        if (error) throw new ErroreCodice(error.code, status);
      }
      return [true, `scritte ${N}; lunghezza di una chiave ${chiaveRiga(0).length} caratteri`];
    });

    await prova("insert doppio: creaSeAssente (codice di archivio.ts)", async () => {
      const a = await archivio.creaSeAssente(chiaveDoppia, "1");
      const b = await archivio.creaSeAssente(chiaveDoppia, "2");
      return [a.stato === "creata" && b.stato === "esiste", `primo=${a.stato} secondo=${b.stato}`];
    });
    await prova("insert doppio: codice grezzo di PostgREST", async () => {
      const { error, status } = await client
        .from("app_config")
        .insert({ key: chiaveDoppia, value: "3" });
      return [
        error?.code === "23505",
        `error.code=${error?.code ?? "nessuno"} stato=${status ?? "?"} (atteso 23505)`,
      ];
    });
    await prova("il doppio non ha sovrascritto", async () => {
      const { data, error, status } = await client.from("app_config").select("value").eq("key", chiaveDoppia);
      if (error) throw new ErroreCodice(error.code, status);
      return [data?.length === 1 && data[0].value === "1", `righe=${data?.length ?? 0} valore_originale=${data?.[0]?.value === "1"}`];
    });

    await prova("tetto di righe per risposta (limit 1500, una sola richiesta)", async () => {
      const { data, error, status } = await client
        .from("app_config")
        .select("key")
        .like("key", `${PREFISSO_LIKE}%`)
        .order("key", { ascending: true })
        .limit(1500);
      if (error) throw new ErroreCodice(error.code, status);
      const n = data?.length ?? 0;
      const nota = n < 1000 ? "SOTTO i 1000: nessun problema, emissione-bulk.ts prosegue fino a una pagina vuota" : n === 1000 ? "tetto 1000, come previsto" : "tetto sopra 1000: la pagina da 1000 resta valida";
      return [n > 0, `righe=${n} (${nota})`];
    });

    let attese = N + 1;
    await prova(`lettura paginata per chiave (leggiPrefissoPerChiave) oltre 1000: ${attese} chiavi`, async () => {
      const lette = await archivio.leggiPrefissoPerChiave(PREFISSO);
      const uniche = new Set(lette.map((r) => r.key));
      const tutte = Array.from({ length: N }, (_, i) => chiaveRiga(i)).every((k) => uniche.has(k)) && uniche.has(chiaveDoppia);
      return [lette.length === attese && uniche.size === attese && tutte, `lette=${lette.length} uniche=${uniche.size} tutte_presenti=${tutte}`];
    });

    await prova(`lettura paginata con ${EXTRA} inserimenti in corso`, async () => {
      attese += EXTRA;
      const inserisci = async () => {
        for (let i = 0; i < EXTRA; i += 10) {
          const { error, status } = await client.from("app_config").insert(extra.slice(i, i + 10));
          if (error) throw new ErroreCodice(error.code, status);
        }
      };
      const [lette] = await Promise.all([archivio.leggiPrefissoPerChiave(PREFISSO), inserisci()]);
      const chiavi = lette.map((r) => r.key);
      const uniche = new Set(chiavi);
      const originali = Array.from({ length: N }, (_, i) => chiaveRiga(i)).every((k) => uniche.has(k)) && uniche.has(chiaveDoppia);
      //  Quelle nate durante la lettura possono esserci o no; le 1.201 di prima ci devono essere tutte, una volta sola.
      return [
        originali && uniche.size === chiavi.length && chiavi.length >= N + 1 && chiavi.length <= attese,
        `lette=${chiavi.length} senza_doppioni=${uniche.size === chiavi.length} originali_tutte=${originali}`,
      ];
    });

    await prova("leggiMolte con 100 chiavi lunghe (2 richieste da 50)", async () => {
      const chiavi = Array.from({ length: 100 }, (_, i) => chiaveRiga(i));
      const lette = await archivio.leggiMolte(chiavi);
      return [lette.length === 100, `lette=${lette.length}`];
    });

    //  ── La porta schede: SOLA LETTURA, la stessa forma di api.crm.fatture-bulk.ts ──
    await prova("porta schede su crm_leads (alias nome:data->>nome, order id, range)", async () => {
      const uno = await client.from("crm_leads").select("user_id").limit(1);
      if (uno.error) throw new ErroreCodice(uno.error.code, uno.status);
      const utente = uno.data?.[0]?.user_id;
      if (!utente) return [true, "nessuna scheda nel CRM: forma non verificabile (non è un errore)"];
      const colonne =
        "id,nome:data->>nome,cognome:data->>cognome,codiceFiscale:data->>codiceFiscale,telefono:data->>telefono";
      const pagina = async (da, a) => {
        const { data, error, status } = await client
          .from("crm_leads")
          .select(colonne)
          .eq("user_id", utente)
          .order("id")
          .range(da, a);
        if (error) throw new ErroreCodice(error.code, status);
        return data ?? [];
      };
      const tutte = [];
      for (let p = 0, da = 0; p < MAX_PAGINE_SCHEDE; p++, da += PAGINA_SCHEDE) {
        const blocco = await pagina(da, da + PAGINA_SCHEDE - 1);
        if (blocco.length > PAGINA_SCHEDE) return [false, `una pagina ha ${blocco.length} righe (più di ${PAGINA_SCHEDE})`];
        tutte.push(...blocco);
        if (blocco.length < PAGINA_SCHEDE) break;
      }
      const primaRiga = tutte[0];
      const campi = Object.keys(primaRiga).sort().join(",") === [...CAMPI_SCHEDA].sort().join(",");
      //  Del contenuto si contano solo i tipi: stringa/nulla. Nessun valore esce da qui.
      const tipiOk = tutte.every((r) => CAMPI_SCHEDA.slice(1).every((c) => r[c] === null || typeof r[c] === "string"));
      const idUnici = new Set(tutte.map((r) => r.id)).size === tutte.length;
      const ordinati = tutte.every((r, i) => i === 0 || tutte[i - 1].id < r.id);
      //  `range` risponde la finestra giusta: righe 1..2 sono la seconda e la terza della prima lettura.
      const finestra = tutte.length >= 3 ? await pagina(1, 2) : null;
      const rangeOk = finestra ? finestra.length === 2 && finestra[0].id === tutte[1].id && finestra[1].id === tutte[2].id : null;
      return [
        campi && tipiOk && idUnici && ordinati && rangeOk !== false,
        `schede=${tutte.length} campi_attesi=${campi} valori_stringa_o_nulli=${tipiOk} id_unici=${idUnici} id_in_ordine=${ordinati} range_1_2=${rangeOk === null ? "non verificabile (meno di 3 schede)" : rangeOk}`,
      ];
    });
  } finally {
    if (iniziato) {
      //  ⚠️ Cancellazione col prefisso COSTANTE (mai una variabile): una chiamata sola per tutto.
      const t0 = ora();
      let rimaste = null;
      let esito;
      try {
        const errore = await archivio.eliminaPerPrefisso(PREFISSO);
        esito = errore ? "errore (messaggio non mostrato)" : "ok";
      } catch (e) {
        esito = descrivi(e);
      }
      try {
        rimaste = await contaPrefisso(client);
      } catch (e) {
        esito += ` · conteggio: ${descrivi(e)}`;
      }
      //  Seconda strada, senza `LIKE`: le chiavi note si rileggono una per una. Se il modello non avesse
      //  trovato niente né in cancellazione né nel conteggio, qui le righe si vedrebbero lo stesso.
      let note = null;
      try {
        const conosciute = [
          ...Array.from({ length: N }, (_, i) => chiaveRiga(i)),
          chiaveDoppia,
          ...extra.map((r) => r.key),
        ];
        note = (await archivio.leggiMolte(conosciute)).length;
      } catch (e) {
        esito += ` · rilettura chiavi note: ${descrivi(e)}`;
      }
      //  Un conteggio che manca (null) non vale zero: pulito solo se TUTTE e due le strade dicono 0.
      const pulito = rimaste === 0 && note === 0;
      esiti.push(pulito);
      stampa(
        `${pulito ? "OK  " : "NO  "} pulizia con eliminaPerPrefisso: ${esito}; righe rimaste con il prefisso=${rimaste ?? "sconosciuto"}; chiavi note ancora presenti=${note ?? "sconosciuto"} (${Math.round(ora() - t0)} ms)`,
      );
      if (!pulito) stampa(`ATTENZIONE: possono restare righe di prova. Nel pannello SQL di Supabase: ${SQL_PULIZIA}`);
    }
  }
  const tutteOk = esiti.length > 0 && esiti.every(Boolean);
  stampa(`ESITO: ${tutteOk ? "TUTTO OK" : "CI SONO PROVE FALLITE"} (${esiti.filter(Boolean).length} su ${esiti.length})`);
  return tutteOk ? 0 : 1;
}

/* ═══════════════════════════════════════════════════════════════════════════
   5. AVVIO (solo se lanciato da terminale, non se importato dalle prove a secco)
   ═════════════════════════════════════════════════════════════════════════ */

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const radice = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  process.exitCode = await esegui({ env: process.env, argv: process.argv.slice(2), radice });
}
