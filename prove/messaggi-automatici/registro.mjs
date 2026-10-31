/** ── PROVE: IL REGISTRO (messaggioAcceso, registroTutto, imposta), LA ROTTA E IL CLIENT ──
 *
 *  Commessa 2026-10-31-interruttori-automatici, compito T2. Il registro lato server
 *  (`src/crm/messaggi-automatici/registro.server.ts`) parla con Supabase: qui si impacchetta
 *  il file VERO con una Supabase finta (nessuna rete, nessun database, nessun dato dei clienti)
 *  e si guardano le chiamate che fa. Si prova:
 *   - `messaggioAcceso`: UNA lettura, nessuna scrittura; falso se chiave ignota, riga
 *     mancante, errore del database, messaggio bloccato dal codice;
 *   - `imposta`: compare-and-set perso = 409 e nessuna scrittura in più, voce bloccata = 409,
 *     controlli prima di accendere (frase del modulo, indirizzo sede), `attivoDal`/`avvio` nel JSON
 *     di conferma e fattura, compensazione se questo passo fallisce, nome di chi clicca dal server;
 *   - la rotta (letta nel sorgente come `prenota-interruttore.mjs`): permesso «impostazioni»
 *     su GET e POST (senza permesso = 403 dal `guardiaCRM`), il nome viene dalla sessione;
 *   - il client: l'indirizzo, il corpo, gli errori.
 *
 *  `mod`: i moduli impacchettati da `prove/prove.mjs`. `aiuti`: `{ c, gruppo, radice }`. */
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "esbuild";

/** Impacchetta un modulo `.ts` mettendo al posto di alcuni import un codice finto. */
async function caricaConFinte(radice, relativo, finte) {
  const dove = mkdtempSync(join(tmpdir(), "registro-messaggi-"));
  try {
    const fuori = join(dove, "modulo.cjs");
    await build({
      entryPoints: [join(radice, relativo)],
      bundle: true,
      format: "cjs",
      outfile: fuori,
      alias: { "@": join(radice, "src") },
      logLevel: "error",
      plugins: [
        {
          name: "finte",
          setup(b) {
            for (const [percorso, codice] of Object.entries(finte)) {
              const esatto = new RegExp(`^${percorso.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}$`);
              b.onResolve({ filter: esatto }, (a) => ({ path: a.path, namespace: "finta" }));
              b.onLoad({ filter: esatto, namespace: "finta" }, () => ({
                contents: codice,
                loader: "js",
              }));
            }
          },
        },
      ],
    });
    return createRequire(import.meta.url)(fuori);
  } finally {
    rmSync(dove, { recursive: true, force: true });
  }
}

/** Una Supabase finta: registra ogni chiamata, risponde con quello che decide la prova.
 *  `risposte[tabella](chiamata)` → `{ data, error }`; `rpc(fn, args)` idem. */
function creaFinta() {
  const stato = {
    chiamate: [],
    risposte: {},
    rpc: () => ({ data: true, error: null }),
  };
  const esito = async (chiamata, f) => {
    const r = await f(chiamata);
    if (r === "lancia") throw new Error("rete");
    return r ?? { data: null, error: null };
  };
  stato.db = {
    from(tabella) {
      const ch = { tabella, op: "select", filtri: [], valore: null };
      stato.chiamate.push(ch);
      const f = () => stato.risposte[tabella] ?? (() => ({ data: null, error: null }));
      const q = {
        select(colonne) {
          ch.colonne = colonne;
          return q;
        },
        eq(c, v) {
          ch.filtri.push([c, v]);
          return q;
        },
        order() {
          return q;
        },
        limit(n) {
          ch.limite = n;
          return q;
        },
        maybeSingle: () => esito(ch, f()),
        upsert(valore, opzioni) {
          ch.op = "upsert";
          ch.valore = valore;
          ch.opzioni = opzioni;
          return esito(ch, f());
        },
        then: (ok, ko) => esito(ch, f()).then(ok, ko),
      };
      return q;
    },
    rpc(fn, args) {
      const ch = { tabella: null, op: "rpc", fn, args };
      stato.chiamate.push(ch);
      return esito(ch, () => stato.rpc(fn, args, ch));
    },
  };
  return stato;
}

export async function proveRegistroMessaggi(mod, { c, gruppo, radice }) {
  const K = mod["messaggi-automatici/catalogo"];
  const leggi = (f) => readFileSync(join(radice, f), "utf8");

  const finta = creaFinta();
  globalThis.__dbFintaMessaggi = finta;
  const R = await caricaConFinte(radice, "src/crm/messaggi-automatici/registro.server.ts", {
    "@/integrations/supabase/client.server": `
      const d = () => globalThis.__dbFintaMessaggi.db;
      export const supabaseAdmin = { from: (t) => d().from(t), rpc: (f, a) => d().rpc(f, a) };`,
  });
  const CL = await caricaConFinte(radice, "src/crm/messaggi-automatici/client.ts", {
    "@/crm/AuthContext": `export const fetchCRM = (...a) => globalThis.__fetchFintoMessaggi(...a);`,
  });

  const ADESSO = new Date("2026-10-31T13:02:00.000Z");
  const FRASE_OK = {
    fraseModulo: { il: "2026-10-25T23:00:00.000Z", da: "Mario", segnatoIl: "2026-10-26T10:00:00Z" },
  };
  const rigaConfig = (extra = {}) => ({
    id: 1,
    user_id: "u-1",
    canale: "manychat",
    acceso: true,
    indirizzo_sede: null,
    controlli: null,
    fermato_motivo: null,
    ...extra,
  });
  /** riparte da zero: nessuna chiamata registrata, risposte di default */
  const riparti = (risposte = {}, rpc) => {
    finta.chiamate.length = 0;
    finta.risposte = { ...risposte };
    finta.rpc = rpc ?? (() => ({ data: true, error: null }));
  };
  const scritture = () =>
    finta.chiamate.filter((x) => x.op === "upsert" || x.op === "rpc").map((x) => x.fn ?? x.tabella);
  const rpcFatte = () => finta.chiamate.filter((x) => x.op === "rpc");
  const jsonApp = (chiave, oggetto) => ({
    app_config: (ch) =>
      ch.op === "select" && ch.filtri.some(([k, v]) => k === "key" && v === chiave)
        ? { data: oggetto === undefined ? null : { value: JSON.stringify(oggetto) }, error: null }
        : { data: null, error: null },
  });

  // ══ messaggioAcceso ═════════════════════════════════════════════════════
  gruppo("MESSAGGI AUTOMATICI · REGISTRO · messaggioAcceso");
  c(
    "esporta le funzioni del contratto",
    ["function", "function", "function", "function", "function"],
    [
      typeof R.messaggioAcceso,
      typeof R.registroTutto,
      typeof R.leggiRegistro,
      typeof R.imposta,
      typeof R.rispostaMessaggi,
    ],
  );
  const riga = (chiave, acceso, acceso_dal = null) => ({ chiave, acceso, acceso_dal });
  const rispondeRiga = (r) => ({
    messaggi_automatici: () => ({ data: r, error: null }),
  });

  riparti(rispondeRiga({ acceso: true }));
  c("riga accesa → vero", true, await R.messaggioAcceso("primo_contatto"));
  c(
    "…UNA lettura sola, della tabella giusta con la chiave giusta, e nessuna scrittura",
    [1, "messaggi_automatici", [["chiave", "primo_contatto"]], []],
    [finta.chiamate.length, finta.chiamate[0]?.tabella, finta.chiamate[0]?.filtri, scritture()],
  );
  riparti(rispondeRiga({ acceso: false }));
  c("riga spenta → falso", false, await R.messaggioAcceso("primo_contatto"));
  riparti(rispondeRiga(null));
  c("riga mancante → falso", false, await R.messaggioAcceso("primo_contatto"));
  riparti(rispondeRiga({ acceso: "true" }));
  c("«acceso» che non è `true` esatto → falso", false, await R.messaggioAcceso("primo_contatto"));
  riparti({ messaggi_automatici: () => ({ data: null, error: { code: "42P01" } }) });
  c(
    "tabella mancante (migrazione non applicata) → falso",
    false,
    await R.messaggioAcceso("primo_contatto"),
  );
  riparti({ messaggi_automatici: () => ({ data: null, error: { code: "08006" } }) });
  c("errore del database → falso", false, await R.messaggioAcceso("primo_contatto"));
  riparti({ messaggi_automatici: () => "lancia" });
  c(
    "la rete lancia → falso (mai un'eccezione verso chi invia)",
    false,
    await R.messaggioAcceso("primo_contatto"),
  );
  riparti(rispondeRiga({ acceso: true }));
  c(
    "chiave ignota o «manuale» → falso, senza nemmeno leggere il database",
    [false, false, false, false, 0],
    [
      await R.messaggioAcceso("inventata"),
      await R.messaggioAcceso("manuale"),
      await R.messaggioAcceso(""),
      await R.messaggioAcceso(undefined),
      finta.chiamate.length,
    ],
  );
  c(
    "messaggio bloccato dal codice (messaggio all'ora, acconto): falso anche se il database lo dà acceso, senza leggere",
    [false, false, 0],
    [
      await R.messaggioAcceso("meet_adesso"),
      await R.messaggioAcceso("stato:in_attesa_acconto"),
      finta.chiamate.length,
    ],
  );
  riparti(rispondeRiga({ acceso: true }));
  const tuttiVeri = [];
  for (const v of K.CATALOGO.filter((x) => !x.bloccataDalCodice))
    tuttiVeri.push(await R.messaggioAcceso(v.chiave));
  c(
    "ogni chiave del catalogo non bloccata si legge",
    true,
    tuttiVeri.every((x) => x === true),
  );

  // ══ leggiRegistro, registroTutto ════════════════════════════════════════
  gruppo("MESSAGGI AUTOMATICI · REGISTRO · leggiRegistro e registroTutto");
  const righe3 = [riga("primo_contatto", true, "2026-10-30T08:00:00Z"), riga("ritorno", false)];
  const logDi = (n) =>
    Array.from({ length: n }, (_, i) => ({
      chiave: i % 2 ? "ritorno" : "primo_contatto",
      prima: !!(i % 2),
      dopo: !(i % 2),
      da: "Filippo",
      il: new Date(Date.UTC(2026, 9, 31, 12, 0) - i * 60_000).toISOString(),
    }));
  riparti({
    messaggi_automatici: () => ({ data: righe3, error: null }),
    messaggi_automatici_registro: () => ({ data: logDi(30), error: null }),
  });
  c("leggiRegistro: le righe del database", righe3, await R.leggiRegistro());
  const tutto = await R.registroTutto();
  c(
    "registroTutto: righe, ultime 20 dal log (la più recente prima) e migrazione presente",
    [righe3, 20, false, logDi(30)[0].il],
    [tutto.righe, tutto.ultime.length, tutto.mancaMigrazione, tutto.ultime[0].il],
  );
  riparti({ messaggi_automatici: () => ({ data: null, error: { code: "PGRST205" } }) });
  const manca = await R.registroTutto();
  c(
    "tabella mancante: righe `null` (illeggibile), nessun log, `mancaMigrazione` vero",
    [null, [], true],
    [manca.righe, manca.ultime, manca.mancaMigrazione],
  );
  riparti({ messaggi_automatici: () => ({ data: null, error: { code: "08006" } }) });
  const rotto = await R.registroTutto();
  c(
    "altro errore: righe `null`, ma NON «manca la migrazione»",
    [null, false],
    [rotto.righe, rotto.mancaMigrazione],
  );
  riparti({ messaggi_automatici: () => "lancia" });
  c("la rete lancia: leggiRegistro dà `null` (fail-closed)", null, await R.leggiRegistro());
  c(
    "leggere il registro non scrive mai",
    [],
    (() => {
      riparti({ messaggi_automatici: () => ({ data: righe3, error: null }) });
      return scritture();
    })(),
  );

  // ══ rispostaMessaggi (GET) ══════════════════════════════════════════════
  gruppo("MESSAGGI AUTOMATICI · REGISTRO · la risposta del pannello (GET)");
  const tutteSpente = K.CHIAVI_MESSAGGI.map((k) => riga(k, false));
  const conAcceso = (accesi, dal = "2026-10-30T08:00:00Z") =>
    K.CHIAVI_MESSAGGI.map((k) => riga(k, accesi.includes(k), accesi.includes(k) ? dal : null));
  const risposteGet = (righe, log, config) => ({
    messaggi_automatici: () => ({ data: righe, error: null }),
    messaggi_automatici_registro: () => ({ data: log, error: null }),
    manychat_config: () => ({ data: config, error: null }),
  });
  riparti(
    risposteGet(
      conAcceso(["primo_contatto", "stato:viene_in_sede"]),
      [
        { chiave: "ritorno", prima: true, dopo: false, da: "Filippo", il: "2026-10-31T12:30:00Z" },
        { chiave: "ritorno", prima: false, dopo: true, da: "Mario", il: "2026-10-30T09:00:00Z" },
        {
          chiave: "primo_contatto",
          prima: false,
          dopo: true,
          da: "Mario",
          il: "2026-10-30T08:00:00Z",
        },
      ],
      rigaConfig({ acceso: true, canale: "cloud", fermato_motivo: "2 invii falliti di fila" }),
    ),
  );
  const g = await R.rispostaMessaggi();
  c("25 voci, nell'ordine del catalogo", K.CHIAVI_MESSAGGI.length, g.voci.length);
  c(
    "…le chiavi nello stesso ordine",
    [...K.CHIAVI_MESSAGGI],
    g.voci.map((v) => v.chiave),
  );
  const v = (k) => g.voci.find((x) => x.chiave === k);
  c(
    "acceso e data di accensione dal registro",
    [true, "2026-10-30T08:00:00Z", false, null],
    [
      v("primo_contatto").acceso,
      v("primo_contatto").accesoDal,
      v("ritorno").acceso,
      v("ritorno").accesoDal,
    ],
  );
  c(
    "«ultima» = l'ultima riga del log di QUELLA chiave (la più recente); `null` se mai toccata",
    [
      { da: "Filippo", il: "2026-10-31T12:30:00Z", dopo: false },
      { da: "Mario", il: "2026-10-30T08:00:00Z", dopo: true },
      null,
    ],
    [v("ritorno").ultima, v("primo_contatto").ultima, v("richiamo_24h").ultima],
  );
  c("le ultime modifiche: tutte le righe del log (sono meno di 20)", 3, g.ultime.length);
  c(
    "la fascia: generale, canale e fermo dalla riga di `manychat_config`",
    { generale: true, canale: "cloud", fermatoMotivo: "2 invii falliti di fila" },
    g.fascia,
  );
  c("niente `mancaMigrazione`", undefined, g.mancaMigrazione);
  c(
    "impedimenti: nessuno per un messaggio acceso; per «Ritorno» (lead nuovo) senza la data della frase c'è",
    [null, true],
    [v("primo_contatto").impedimento, /data della frase/.test(v("ritorno").impedimento ?? "")],
  );
  c(
    "…un messaggio acceso non ha mai un impedimento (anche «Appuntamento in sede» senza indirizzo)",
    null,
    v("stato:viene_in_sede").impedimento,
  );
  c(
    "…le due voci bloccate dal codice: grigie, con la ragione",
    [true, true],
    [
      /codice/i.test(v("meet_adesso").impedimento ?? ""),
      /codice/i.test(v("stato:in_attesa_acconto").impedimento ?? ""),
    ],
  );
  c(
    "…«Giorno prima» e «Sollecito 24 ore» non hanno impedimenti propri (la frase riguarda il lead nuovo)",
    [null, true],
    [v("meet_domani").impedimento, /data della frase/.test(v("richiamo_24h").impedimento ?? "")],
  );

  riparti(
    risposteGet(
      tutteSpente,
      [],
      rigaConfig({ controlli: FRASE_OK, indirizzo_sede: "  Via Roma 1 " }),
    ),
  );
  const g2 = await R.rispostaMessaggi();
  const v2 = (k) => g2.voci.find((x) => x.chiave === k);
  c(
    "con la data della frase e l'indirizzo: le voci del lead nuovo e la sede non hanno impedimenti",
    [null, null, null, null, null],
    [
      v2("primo_contatto").impedimento,
      v2("richiamo_24h").impedimento,
      v2("ritorno").impedimento,
      v2("casi_reali").impedimento,
      v2("stato:viene_in_sede").impedimento,
    ],
  );
  riparti(risposteGet(tutteSpente, [], rigaConfig({ controlli: FRASE_OK })));
  const g3 = await R.rispostaMessaggi();
  c(
    "senza indirizzo, «Appuntamento in sede» spento ha il suo impedimento",
    true,
    /indirizzo/i.test(g3.voci.find((x) => x.chiave === "stato:viene_in_sede").impedimento ?? ""),
  );
  riparti({
    messaggi_automatici: () => ({ data: null, error: { code: "42P01" } }),
    manychat_config: () => ({ data: rigaConfig(), error: null }),
  });
  const g4 = await R.rispostaMessaggi();
  c(
    "senza la migrazione: tutto spento, `mancaMigrazione`, ogni voce dice perché",
    [true, 25, true, 0],
    [
      g4.mancaMigrazione,
      g4.voci.filter((x) => !x.acceso).length,
      g4.voci.every((x) => /aggiornamento del database/.test(x.impedimento ?? "")),
      g4.ultime.length,
    ],
  );
  riparti(risposteGet(tutteSpente, [], null));
  c(
    "senza riga di `manychat_config`: generale spento, canale cloud",
    { generale: false, canale: "cloud", fermatoMotivo: null },
    (await R.rispostaMessaggi()).fascia,
  );
  riparti({
    messaggi_automatici: () => ({ data: null, error: { code: "08006" } }),
    manychat_config: () => ({ data: rigaConfig(), error: null }),
  });
  let lanciata = null;
  try {
    await R.rispostaMessaggi();
  } catch (e) {
    lanciata = e;
  }
  c(
    "registro illeggibile per un guasto vero: la risposta LANCIA col solo codice (la rotta fa 500)",
    { code: "08006" },
    lanciata,
  );

  // ══ leggiComandoImposta ═════════════════════════════════════════════════
  gruppo("MESSAGGI AUTOMATICI · REGISTRO · il corpo del POST");
  const lc = R.leggiComandoImposta;
  c(
    "un corpo giusto passa, con i soli tre campi",
    { ok: true, comando: { chiave: "ritorno", acceso: true, prima: false } },
    lc({ chiave: "ritorno", acceso: true, prima: false, da: "Furbo", nome: "X" }),
  );
  c(
    "chiave sconosciuta, «manuale», vuota → 400",
    [false, false, false],
    [
      lc({ chiave: "inventata", acceso: true, prima: false }).ok,
      lc({ chiave: "manuale", acceso: true, prima: false }).ok,
      lc({ chiave: "", acceso: true, prima: false }).ok,
    ],
  );
  c(
    "acceso o prima non booleani, o mancanti → rifiutato",
    [false, false, false, false],
    [
      lc({ chiave: "ritorno", acceso: "si", prima: false }).ok,
      lc({ chiave: "ritorno", acceso: true, prima: 0 }).ok,
      lc({ chiave: "ritorno", acceso: true }).ok,
      lc({ chiave: "ritorno", prima: false }).ok,
    ],
  );
  c(
    "«prima» uguale ad «acceso» (niente da cambiare) → rifiutato",
    false,
    lc({ chiave: "ritorno", acceso: true, prima: true }).ok,
  );
  c(
    "corpo non oggetto → rifiutato, e dà una frase",
    [false, false, false, true],
    [
      lc(null).ok,
      lc("ciao").ok,
      lc([]).ok,
      typeof lc(null).errore === "string" && lc(null).errore.length > 0,
    ],
  );

  // ══ imposta ═════════════════════════════════════════════════════════════
  gruppo("MESSAGGI AUTOMATICI · REGISTRO · imposta");
  const tutteLeggibili = (extra = {}) => ({
    messaggi_automatici: () => ({ data: tutteSpente, error: null }),
    messaggi_automatici_registro: () => ({ data: [], error: null }),
    manychat_config: () => ({
      data: rigaConfig({ controlli: FRASE_OK, indirizzo_sede: "Via Roma 1" }),
      error: null,
    }),
    ...extra,
  });
  const cmd = (chiave, acceso, prima = !acceso) => ({ chiave, acceso, prima });

  riparti(tutteLeggibili());
  const r1 = await R.imposta(cmd("promemoria_meet", true), "Filippo", ADESSO);
  c(
    "accendere: ok e la risposta è già riletta (25 voci)",
    [true, 25],
    [r1.ok, r1.risposta?.voci.length],
  );
  c(
    "…UNA chiamata alla funzione SQL (compare-and-set + log nella stessa transazione), col nome dal server",
    [
      1,
      "messaggio_automatico_imposta",
      { p_chiave: "promemoria_meet", p_prima: false, p_dopo: true, p_da: "Filippo" },
    ],
    [rpcFatte().length, rpcFatte()[0]?.fn, rpcFatte()[0]?.args],
  );
  c(
    "…e nessuna scrittura diretta (né sul registro né sul log: lo fa la funzione)",
    [],
    finta.chiamate.filter((x) => x.op === "upsert"),
  );

  riparti(tutteLeggibili(), () => ({ data: false, error: null }));
  const perso = await R.imposta(cmd("promemoria_meet", true), "Filippo", ADESSO);
  c(
    "compare-and-set perso (qualcuno ha cambiato nel frattempo) → 409 «Nel frattempo è cambiato: ricarica»",
    [false, 409, "Nel frattempo è cambiato: ricarica"],
    [perso.ok, perso.stato, perso.errore],
  );
  c(
    "…nessun'altra scrittura dopo la funzione",
    [1, []],
    [rpcFatte().length, finta.chiamate.filter((x) => x.op === "upsert")],
  );

  riparti(tutteLeggibili(), () => ({ data: false, error: null }));
  const perso2 = await R.imposta(cmd("conferma_consulenza", true), "Filippo", ADESSO);
  c(
    "…perso su «Conferma»: il JSON di app_config non si tocca",
    [409, []],
    [perso2.stato, finta.chiamate.filter((x) => x.tabella === "app_config" && x.op === "upsert")],
  );

  riparti(tutteLeggibili());
  const bl = [];
  for (const k of ["meet_adesso", "stato:in_attesa_acconto"])
    for (const acceso of [true, false]) bl.push(await R.imposta(cmd(k, acceso), "Filippo", ADESSO));
  c(
    "voci bloccate dal codice (accendere o spegnere): 409 «Spento nel codice», mai la funzione",
    [[false, false, false, false], [409, 409, 409, 409], true, 0],
    [
      bl.map((x) => x.ok),
      bl.map((x) => x.stato),
      bl.every((x) => /Spento nel codice/.test(x.errore)),
      rpcFatte().length,
    ],
  );

  riparti(tutteLeggibili());
  const sconosciuta = await R.imposta(
    { chiave: "inventata", acceso: true, prima: false },
    "Filippo",
    ADESSO,
  );
  c(
    "chiave fuori dal catalogo (anche se il corpo arriva fino a qui): 400, mai la funzione",
    [false, 400, 0],
    [sconosciuta.ok, sconosciuta.stato, rpcFatte().length],
  );

  // ── i controlli prima di accendere ──
  riparti(tutteLeggibili({ manychat_config: () => ({ data: rigaConfig(), error: null }) }));
  const senzaFrase = [];
  for (const k of K.FAMIGLIA_LEAD_NUOVO)
    senzaFrase.push(await R.imposta(cmd(k, true), "Filippo", ADESSO));
  c(
    "accendere uno dei quattro «lead nuovo» senza la data della frase → 422, mai la funzione",
    [[422, 422, 422, 422], true, 0],
    [
      senzaFrase.map((x) => x.stato),
      senzaFrase.every((x) => /data della frase/.test(x.errore)),
      rpcFatte().length,
    ],
  );
  riparti(
    tutteLeggibili({
      manychat_config: () => ({ data: rigaConfig({ lead_nuovo: true }), error: null }),
    }),
  );
  c(
    "…neanche se il vecchio interruttore congelato dice «acceso»: il vecchio valore non conta",
    422,
    (await R.imposta(cmd("primo_contatto", true), "Filippo", ADESSO)).stato,
  );
  riparti(tutteLeggibili({ manychat_config: () => ({ data: rigaConfig(), error: null }) }));
  c(
    "spegnere uno dei quattro non chiede la frase",
    [true, 1],
    ((x) => [x.ok, rpcFatte().length])(
      await R.imposta(cmd("primo_contatto", false), "Filippo", ADESSO),
    ),
  );
  riparti(tutteLeggibili({ manychat_config: () => ({ data: rigaConfig(), error: null }) }));
  c(
    "gli altri messaggi si accendono senza la frase (es. «Mattina del meet»)",
    true,
    (await R.imposta(cmd("meet_oggi", true), "Filippo", ADESSO)).ok,
  );
  riparti(
    tutteLeggibili({
      manychat_config: () => ({ data: rigaConfig({ controlli: FRASE_OK }), error: null }),
    }),
  );
  const sede = await R.imposta(cmd("stato:viene_in_sede", true), "Filippo", ADESSO);
  c(
    "«Appuntamento in sede» senza indirizzo → 422 con la ragione, mai la funzione",
    [422, true, 0],
    [sede.stato, /indirizzo/i.test(sede.errore), rpcFatte().length],
  );
  riparti(
    tutteLeggibili({
      manychat_config: () => ({ data: rigaConfig({ indirizzo_sede: "   " }), error: null }),
    }),
  );
  c(
    "…un indirizzo di soli spazi vale «nessuno»",
    422,
    (await R.imposta(cmd("stato:viene_in_sede", true), "Filippo", ADESSO)).stato,
  );
  riparti(tutteLeggibili());
  c(
    "…con l'indirizzo si accende",
    true,
    (await R.imposta(cmd("stato:viene_in_sede", true), "Filippo", ADESSO)).ok,
  );
  riparti(tutteLeggibili({ manychat_config: () => ({ data: null, error: { code: "08006" } }) }));
  const cfgRotta = await R.imposta(cmd("meet_oggi", true), "Filippo", ADESSO);
  c(
    "se non si riesce a leggere `manychat_config` per i controlli: 500 e nessuna accensione",
    [500, 0],
    [cfgRotta.stato, rpcFatte().length],
  );

  // ── il nome di chi clicca ──
  riparti(tutteLeggibili());
  await R.imposta(cmd("meet_oggi", true), "x".repeat(200), ADESSO);
  c(
    "il nome è al massimo 80 caratteri (come la funzione SQL)",
    80,
    rpcFatte()[0]?.args.p_da.length,
  );
  riparti(tutteLeggibili());
  await R.imposta(cmd("meet_oggi", true), "", ADESSO);
  c(
    "senza nome: la funzione lo trasforma in «sconosciuto» (qui parte vuoto, mai un nome inventato)",
    "",
    rpcFatte()[0]?.args.p_da,
  );

  // ── conferma e fattura: attivoDal e avvio ──
  riparti(
    tutteLeggibili(
      jsonApp("promemoria_whatsapp", {
        acceso: false,
        modelloApprovato: true,
        attivoDal: "2026-10-01T00:00:00Z",
        avvio: "fatto",
      }),
    ),
  );
  const cf = await R.imposta(cmd("conferma_consulenza", true), "Filippo", ADESSO);
  const upConf = finta.chiamate.filter((x) => x.tabella === "app_config" && x.op === "upsert");
  c(
    "accendere «Conferma»: ok, e il JSON di app_config si riscrive UNA volta DOPO la funzione",
    [true, 1, ["rpc", "app_config"]],
    [
      cf.ok,
      upConf.length,
      finta.chiamate
        .filter((x) => x.op === "rpc" || (x.tabella === "app_config" && x.op === "upsert"))
        .map((x) => (x.op === "rpc" ? "rpc" : x.tabella)),
    ],
  );
  const jConf = JSON.parse(upConf[0].valore.value);
  c(
    "…con `acceso` vero, `attivoDal` = adesso, `avvio` «da_fare» (chi c'era prima non riceve niente) e il resto com'era",
    { acceso: true, modelloApprovato: true, attivoDal: ADESSO.toISOString(), avvio: "da_fare" },
    jConf,
  );
  c(
    "…sulla chiave `promemoria_whatsapp`, con upsert su `key`",
    ["promemoria_whatsapp", { onConflict: "key" }],
    [upConf[0].valore.key, upConf[0].opzioni],
  );

  riparti(
    tutteLeggibili(
      jsonApp("dati_fattura_config", {
        acceso: false,
        modelloApprovato: true,
        attivoDal: "2026-10-02T00:00:00Z",
        avvio: "fatto",
      }),
    ),
  );
  const df = await R.imposta(cmd("dati_fattura", true), "Filippo", ADESSO);
  const upDf = finta.chiamate.filter((x) => x.tabella === "app_config" && x.op === "upsert");
  c(
    "accendere «Dati fattura»: `acceso` vero e `avvio` «da_fare»; `attivoDal` e il resto non si toccano (lo scrive il giro, come oggi)",
    [
      true,
      "dati_fattura_config",
      { acceso: true, modelloApprovato: true, attivoDal: "2026-10-02T00:00:00Z", avvio: "da_fare" },
    ],
    [df.ok, upDf[0]?.valore.key, JSON.parse(upDf[0].valore.value)],
  );

  riparti(
    tutteLeggibili({
      app_config: (ch) =>
        ch.op === "select"
          ? { data: { value: "{non json" }, error: null }
          : { data: null, error: null },
    }),
  );
  await R.imposta(cmd("conferma_consulenza", true), "Filippo", ADESSO);
  c(
    "JSON vecchio storto o assente: si riparte da zero, senza errore",
    { acceso: true, attivoDal: ADESSO.toISOString(), avvio: "da_fare" },
    JSON.parse(finta.chiamate.find((x) => x.op === "upsert").valore.value),
  );
  riparti(
    tutteLeggibili({
      app_config: (ch) =>
        ch.op === "select"
          ? { data: { value: "[1,2]" }, error: null }
          : { data: null, error: null },
    }),
  );
  await R.imposta(cmd("dati_fattura", true), "Filippo", ADESSO);
  c(
    "JSON vecchio che non è un oggetto (lista): come assente",
    { acceso: true, avvio: "da_fare" },
    JSON.parse(finta.chiamate.find((x) => x.op === "upsert").valore.value),
  );

  riparti(tutteLeggibili(jsonApp("promemoria_whatsapp", { acceso: true, avvio: "fatto" })));
  const sp = await R.imposta(cmd("conferma_consulenza", false), "Filippo", ADESSO);
  c(
    "spegnere «Conferma» o «Dati fattura»: solo il registro, il JSON non si tocca",
    [true, 1, 0],
    [sp.ok, rpcFatte().length, finta.chiamate.filter((x) => x.tabella === "app_config").length],
  );

  // ── compensazione ──
  riparti(
    tutteLeggibili({
      app_config: (ch) =>
        ch.op === "upsert" ? { data: null, error: { code: "08006" } } : { data: null, error: null },
    }),
  );
  const comp = await R.imposta(cmd("conferma_consulenza", true), "Filippo", ADESSO);
  c(
    "se la scrittura del JSON fallisce: il registro si rimette com'era con un secondo compare-and-set, e la risposta è un errore (mai uno stato a metà)",
    [
      false,
      500,
      2,
      { p_chiave: "conferma_consulenza", p_prima: true, p_dopo: false, p_da: "Filippo" },
    ],
    [comp.ok, comp.stato, rpcFatte().length, rpcFatte()[1]?.args],
  );
  riparti(
    tutteLeggibili({
      app_config: (ch) => (ch.op === "upsert" ? "lancia" : { data: null, error: null }),
    }),
  );
  const comp2 = await R.imposta(cmd("dati_fattura", true), "Filippo", ADESSO);
  c(
    "…anche se la scrittura LANCIA invece di rispondere con un errore",
    [false, 500, 2],
    [comp2.ok, comp2.stato, rpcFatte().length],
  );
  riparti(tutteLeggibili({ app_config: () => "lancia" }));
  const comp3 = await R.imposta(cmd("dati_fattura", true), "Filippo", ADESSO);
  c(
    "…o se è la LETTURA del JSON a lanciare",
    [false, 500, 2],
    [comp3.ok, comp3.stato, rpcFatte().length],
  );
  riparti(
    tutteLeggibili({
      app_config: (ch) =>
        ch.op === "upsert" ? { data: null, error: { code: "08006" } } : { data: null, error: null },
    }),
    (fn, args, ch) =>
      rpcFatte().length === 1
        ? { data: true, error: null }
        : { data: null, error: { code: "08006" } },
  );
  const comp4 = await R.imposta(cmd("conferma_consulenza", true), "Filippo", ADESSO);
  c(
    "…e se anche la compensazione fallisce: sempre una risposta d'errore, mai un'eccezione",
    [false, 500],
    [comp4.ok, comp4.stato],
  );

  // ── errori della funzione SQL ──
  riparti(tutteLeggibili(), () => ({ data: null, error: { code: "42883" } }));
  const f1 = await R.imposta(cmd("meet_oggi", true), "Filippo", ADESSO);
  c(
    "funzione SQL mancante (migrazione non applicata) → 503 «Manca l'aggiornamento del database»",
    [503, true],
    [f1.stato, /aggiornamento del database/.test(f1.errore)],
  );
  riparti(tutteLeggibili(), () => ({ data: null, error: { code: "08006" } }));
  const f2 = await R.imposta(cmd("conferma_consulenza", true), "Filippo", ADESSO);
  c(
    "altro errore della funzione → 500, e per «Conferma» il JSON non si tocca",
    [500, 0],
    [
      f2.stato,
      finta.chiamate.filter((x) => x.tabella === "app_config" && x.op === "upsert").length,
    ],
  );
  riparti(tutteLeggibili(), () => "lancia");
  const f3 = await R.imposta(cmd("meet_oggi", true), "Filippo", ADESSO);
  c("la rete lancia → 500, non un'eccezione", [false, 500], [f3.ok, f3.stato]);
  c(
    "nelle frasi d'errore non c'è mai il messaggio del database",
    true,
    [comp, f1, f2, f3, perso, sede].every((x) => !/08006|42883|rete|Error/.test(x.errore ?? "")),
  );

  // ══ la rotta ════════════════════════════════════════════════════════════
  gruppo("MESSAGGI AUTOMATICI · LA ROTTA E IL CLIENT");
  const rotta = leggi("src/routes/api.crm.messaggi-automatici.ts");
  c(
    "rotta: l'indirizzo è /api/crm/messaggi-automatici",
    true,
    /createFileRoute\("\/api\/crm\/messaggi-automatici"\)/.test(rotta),
  );
  c(
    "rotta: GET e POST dietro guardiaCRM col permesso «impostazioni»",
    2,
    (rotta.match(/guardiaCRM\(request, cors, "impostazioni"\)/g) ?? []).length,
  );
  c(
    "rotta: senza permesso si esce con la risposta della guardia (403/401), prima di ogni lettura",
    2,
    (rotta.match(/if \(!g\.ok\) return g\.risposta;/g) ?? []).length,
  );
  c(
    "rotta: il nome di chi clicca è quello della sessione (`g.chi.nome`), mai del corpo",
    [true, false],
    [/imposta\([^)]*g\.chi\.nome/.test(rotta), /corpo[^;\n]*\.(da|nome)\b/.test(rotta)],
  );
  c(
    "rotta: il corpo passa da leggiComandoImposta (400 se storto) e l'esito dell'imposta diventa lo stato HTTP",
    [true, true],
    [/leggiComandoImposta\(corpo\)/.test(rotta), /esito\.stato/.test(rotta)],
  );
  c(
    "rotta: un guasto risponde 500 con una frase, nei log il solo codice",
    [true, true],
    [/500/.test(rotta), !/console\.(warn|error)\([^)]*\be\.message/.test(rotta)],
  );
  c(
    "rotta: non cancella e non ha altri metodi (niente DELETE/PUT/PATCH)",
    false,
    /\b(DELETE|PUT|PATCH)\s*:/.test(rotta),
  );
  const sorgenteRegistro = leggi("src/crm/messaggi-automatici/registro.server.ts");
  c(
    "registro: nessun testo di errore del database nei log (solo `code`)",
    false,
    /console\.(warn|error)\([^)]*(\.message|\bmessage\b)/.test(sorgenteRegistro),
  );
  c(
    "registro: non importa il pannello del server né le porte (niente giri di importazioni con T4)",
    [false, false, false],
    [
      /pannello\.server/.test(
        sorgenteRegistro.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, ""),
      ),
      /porte\.server/.test(
        sorgenteRegistro.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, ""),
      ),
      /porta\.server/.test(
        sorgenteRegistro.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, ""),
      ),
    ],
  );
  c(
    "le chiavi dei due JSON sono quelle che leggono il giro della conferma e quello della fattura",
    [true, true, "promemoria_whatsapp", "dati_fattura_config"],
    [
      /const CHIAVE_CONFIG = "promemoria_whatsapp"/.test(
        leggi("src/routes/hooks/promemoria-whatsapp.ts"),
      ),
      /CHIAVE_CONFIG_DATI_FATTURA = "dati_fattura_config"/.test(
        leggi("src/crm/fatture/dati-fattura.server.ts"),
      ),
      R.CHIAVE_JSON_CONFERMA,
      R.CHIAVE_JSON_FATTURA,
    ],
  );

  // ── il client ──
  const chiamate = [];
  const rispondi = (stato, corpo) => ({
    ok: stato >= 200 && stato < 300,
    status: stato,
    json: async () => {
      if (corpo === "storto") throw new Error("json");
      return corpo;
    },
  });
  const conRisposta = (r) => {
    chiamate.length = 0;
    globalThis.__fetchFintoMessaggi = async (url, init) => {
      chiamate.push({ url, init });
      if (r === "lancia") throw new Error("rete");
      return r;
    };
  };
  c(
    "client: esporta leggiMessaggiAutomatici e impostaMessaggio",
    ["function", "function"],
    [typeof CL.leggiMessaggiAutomatici, typeof CL.impostaMessaggio],
  );
  conRisposta(rispondi(200, { voci: [], fascia: {}, ultime: [] }));
  const lettura = await CL.leggiMessaggiAutomatici();
  c(
    "client: la lettura è un GET sull'indirizzo giusto",
    [true, "/api/crm/messaggi-automatici", undefined],
    [lettura.ok, chiamate[0].url, chiamate[0].init],
  );
  conRisposta(rispondi(200, { voci: [1], fascia: {}, ultime: [] }));
  const salva = await CL.impostaMessaggio({
    chiave: "ritorno",
    acceso: true,
    prima: false,
    da: "Furbo",
  });
  c(
    "client: il POST porta solo chiave, acceso e prima (mai un nome), in JSON",
    ["POST", { chiave: "ritorno", acceso: true, prima: false }, true],
    [
      chiamate[0].init.method,
      JSON.parse(chiamate[0].init.body),
      salva.ok && salva.dati.voci.length === 1,
    ],
  );
  conRisposta(rispondi(409, { error: "Nel frattempo è cambiato: ricarica" }));
  const r409 = await CL.impostaMessaggio({ chiave: "ritorno", acceso: true, prima: false });
  c(
    "client: un 409 arriva con lo stato e la frase del server",
    [false, 409, "Nel frattempo è cambiato: ricarica"],
    [r409.ok, r409.stato, r409.errore],
  );
  conRisposta("lancia");
  const rete = await CL.leggiMessaggiAutomatici();
  c(
    "client: la rete cade → stato 0 e una frase (mai un'eccezione)",
    [false, 0, true],
    [rete.ok, rete.stato, typeof rete.errore === "string" && rete.errore.length > 0],
  );
  conRisposta(rispondi(200, "storto"));
  c(
    "client: una risposta che non è JSON non è un successo",
    false,
    (await CL.leggiMessaggiAutomatici()).ok,
  );
  conRisposta(rispondi(403, { error: "Non hai il permesso." }));
  const r403 = await CL.leggiMessaggiAutomatici();
  c("client: 403 → stato e frase", [403, "Non hai il permesso."], [r403.stato, r403.errore]);

  delete globalThis.__dbFintaMessaggi;
  delete globalThis.__fetchFintoMessaggi;
}
