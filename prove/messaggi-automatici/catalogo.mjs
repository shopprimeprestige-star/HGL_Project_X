/** ── PROVE: IL CATALOGO DEI MESSAGGI AUTOMATICI E LA SUA MIGRAZIONE ─────────
 *
 *  Commessa 2026-10-31-interruttori-automatici, compito T1. Il catalogo
 *  (`src/crm/messaggi-automatici/catalogo.ts`, puro) elenca i 25 messaggi che
 *  partono da soli su WhatsApp, ognuno con la sua chiave. Qui si controlla:
 *   - le chiavi (25, uniche) e che il catalogo copra TUTTO quello che il giro sa
 *     mandare (ogni tipo del giro, ogni stato della tabella degli stati, ogni
 *     modello del riquadro);
 *   - `meet_adesso` e l'acconto sono «bloccati dal codice» SOLO finché le due
 *     costanti nel sorgente sono false;
 *   - la migrazione e i tre script (`supabase/recuperi/`) letti come TESTO:
 *     solo aggiunte, tabelle e funzione chiuse, il seme con le stesse regole di
 *     lettura del codice. Il collaudo su un Postgres vero lo fa
 *     `commesse/2026-10-30-ottimizzazioni/strumenti/pg-prova.sh` (vedi LAVAGNA).
 *
 *  Dati inventati. `mod`: i moduli impacchettati da `prove/prove.mjs`.
 *  `aiuti`: `{ c, gruppo, radice }`. */
import { mkdtempSync, existsSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildSync } from "esbuild";

/** Impacchetta un modulo `.ts` puro in una cartella temporanea e lo carica. */
function carica(radice, relativo) {
  const dove = mkdtempSync(join(tmpdir(), "messaggi-automatici-"));
  try {
    const fuori = join(dove, "modulo.cjs");
    buildSync({
      entryPoints: [join(radice, relativo)],
      bundle: true,
      format: "cjs",
      outfile: fuori,
      alias: { "@": join(radice, "src") },
      logLevel: "error",
    });
    return createRequire(import.meta.url)(fuori);
  } finally {
    rmSync(dove, { recursive: true, force: true });
  }
}

/** Il SQL senza commenti (`-- …` e blocchi): «come si annulla» ha dei DROP scritti apposta nel commento. */
const senzaCommenti = (sql) =>
  sql
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/--[^\n]*/g, "")
    .replace(/[ \t]+\n/g, "\n");

/** Le chiavi del seme: i testi `'xxx'` che aprono una riga di VALUES dentro `hgl_vecchi`. */
const chiaviDelSeme = (sql) => [...sql.matchAll(/^\s*\('([a-z_:0-9]+)',/gm)].map((m) => m[1]);

/** Il blocco delle tre funzioni temporanee (dal primo CREATE a `hgl_vecchi` compresa). */
function bloccoVecchi(sql) {
  const da = sql.indexOf("CREATE OR REPLACE FUNCTION pg_temp.hgl_ts(");
  const f = sql.indexOf("FUNCTION pg_temp.hgl_vecchi(");
  const fine = sql.indexOf("$f$;", f);
  return da < 0 || f < 0 || fine < 0 ? "" : sql.slice(da, fine + 4);
}

export async function proveCatalogoMessaggi(mod, { c, gruppo, radice }) {
  const K = mod["messaggi-automatici/catalogo"];
  const ST = mod["manychat/stati"];
  const W = mod["wa-meta-templates"];
  const V = carica(radice, "src/crm/manychat/vista-pannello.ts");
  const leggi = (f) => readFileSync(join(radice, f), "utf8");

  gruppo("MESSAGGI AUTOMATICI · IL CATALOGO");
  const chiavi = K.CATALOGO.map((v) => v.chiave);
  c("25 messaggi", 25, K.CATALOGO.length);
  c("25 chiavi, tutte diverse", 25, new Set(chiavi).size);
  c(
    "l'elenco delle chiavi è quello del catalogo, nello stesso ordine",
    [...K.CHIAVI_MESSAGGI],
    chiavi,
  );
  c(
    "ogni voce ha nome e «quando parte»",
    [],
    K.CATALOGO.filter((v) => !v.nome?.trim() || !v.quando?.trim()).map((v) => v.chiave),
  );
  c(
    "ogni voce ha il modello O il testo fisso, mai nessuno dei due e mai tutti e due",
    [],
    K.CATALOGO.filter((v) => !!v.modello === !!v.testoFisso).map((v) => v.chiave),
  );
  c(
    "ogni modello e ogni variante esistono fra i modelli del progetto (anteprima possibile)",
    [],
    K.CATALOGO.flatMap((v) => [v.modello, v.variante])
      .filter(Boolean)
      .filter((m) => !W.findMetaTemplate(m)),
  );
  c(
    "il webinar e la risposta «prenota in chat» non hanno modello (testo libero)",
    [true, true],
    ["webinar_in_diretta", "prenota_chat"].map(
      (k) => !K.CATALOGO.find((v) => v.chiave === k).modello,
    ),
  );

  gruppo("MESSAGGI AUTOMATICI · I SEI MOMENTI");
  c(
    "sei momenti, nell'ordine del piano",
    ["primo_contatto", "solleciti", "consulenza", "dopo_consulenza", "acconto_fattura", "webinar"],
    K.GRUPPI.map((g) => g.id),
  );
  const dei = (g) => K.CATALOGO.filter((v) => v.gruppo === g).map((v) => v.chiave);
  c("1 Primo contatto", ["primo_contatto", "ritorno", "casi_reali"], dei("primo_contatto"));
  c(
    "2 Solleciti",
    [
      "richiamo_24h",
      "ricontatto_fissato",
      "stato:sta_valutando",
      "stato:gestire_in_chat",
      "stato:fissa_meet_dopo",
      "stato:non_risponde",
      "stato:segreteria",
      "stato:irreperibile",
    ],
    dei("solleciti"),
  );
  c(
    "3 Consulenza",
    [
      "conferma_consulenza",
      "meet_domani",
      "meet_oggi",
      "promemoria_meet",
      "meet_adesso",
      "stato:richiamo",
      "stato:viene_in_sede",
      "stato:sede_disdetta",
      "prenota_chat",
    ],
    dei("consulenza"),
  );
  c("4 Dopo la consulenza", ["stato:no_show", "stato:da_spostare"], dei("dopo_consulenza"));
  c("5 Acconto e fattura", ["stato:in_attesa_acconto", "dati_fattura"], dei("acconto_fattura"));
  c("6 Webinar", ["webinar_in_diretta"], dei("webinar"));
  c(
    "ogni voce sta in un momento che esiste",
    [],
    K.CATALOGO.filter((v) => !K.GRUPPI.some((g) => g.id === v.gruppo)).map((v) => v.chiave),
  );

  gruppo("MESSAGGI AUTOMATICI · LE FAMIGLIE");
  c(
    "«lead nuovo»: i quattro messaggi che dividono un solo interruttore di oggi",
    ["primo_contatto", "richiamo_24h", "ritorno", "casi_reali"],
    [...K.FAMIGLIA_LEAD_NUOVO],
  );
  c("«giorno del meet»: oggi e domani", ["meet_oggi", "meet_domani"], [...K.FAMIGLIA_GIORNO_MEET]);
  c(
    "le famiglie sono fatte di chiavi del catalogo",
    [],
    [...K.FAMIGLIA_LEAD_NUOVO, ...K.FAMIGLIA_GIORNO_MEET].filter((k) => !chiavi.includes(k)),
  );
  c(
    "eChiaveMessaggio: vero per le 25, falso per il resto (anche «manuale»)",
    [true, false, false, false, false],
    [
      chiavi.every((k) => K.eChiaveMessaggio(k)),
      K.eChiaveMessaggio("manuale"),
      K.eChiaveMessaggio(""),
      K.eChiaveMessaggio(undefined),
      K.eChiaveMessaggio("stato:non_esiste"),
    ],
  );

  gruppo("MESSAGGI AUTOMATICI · OGNI TIPO DEL GIRO HA UNA CHIAVE");
  const senzaStato = {
    primo_contatto: "primo_contatto",
    richiamo_24h: "richiamo_24h",
    ritorno: "ritorno",
    casi_reali: "casi_reali",
    meet_oggi: "meet_oggi",
    meet_domani: "meet_domani",
    meet_adesso: "meet_adesso",
    promemoria: "promemoria_meet",
    promemoria_chiamata: "stato:richiamo",
    promemoria_sede: "stato:viene_in_sede",
    conferma: "conferma_consulenza",
  };
  for (const [tipo, chiave] of Object.entries(senzaStato))
    c(`tipo «${tipo}» → «${chiave}»`, chiave, K.chiaveDi({ tipo }));
  //  Il tipo «ricontatto» da solo non basta: dipende dallo stato della scheda.
  c(
    "«ricontatto» senza stato: nessuna chiave (il giro non invia)",
    null,
    K.chiaveDi({ tipo: "ricontatto" }),
  );
  c(
    "«chat», «prova», «webinar»: nessuna chiave dal solo tipo (il webinar la dichiara a mano)",
    [null, null, null],
    ["chat", "prova", "webinar"].map((tipo) => K.chiaveDi({ tipo })),
  );
  c("un tipo che non esiste: nessuna chiave", null, K.chiaveDi({ tipo: "inventato" }));

  //  Il tipo che il giro dà a uno stato (giro.ts `tipoDelloStato`): chiamata e sede a orario, il resto ricontatto.
  const tipoDelloStato = (s) =>
    s === "richiamo"
      ? "promemoria_chiamata"
      : s === "viene_in_sede"
        ? "promemoria_sede"
        : "ricontatto";
  const tabella = ST.TABELLA_STATI;
  const voce = (k) => K.CATALOGO.find((v) => v.chiave === k);
  c(
    "ogni stato della tabella degli stati ha una chiave nel catalogo",
    [],
    Object.keys(tabella).filter(
      (s) => !chiavi.includes(K.chiaveDi({ tipo: tipoDelloStato(s), stato: s })),
    ),
  );
  c(
    "…e il modello della voce è quello della riga della tabella",
    [],
    Object.entries(tabella)
      .filter(
        ([s, r]) => voce(K.chiaveDi({ tipo: tipoDelloStato(s), stato: s }))?.modello !== r.modello,
      )
      .map(([s]) => s),
  );
  c(
    "gli stati di riga del riquadro: ognuno ha la sua chiave e il suo modello nel catalogo",
    [],
    V.STATI_RIQUADRO.filter((r) => {
      const k = K.chiaveDi({ tipo: tipoDelloStato(r.stato), stato: r.stato });
      return !chiavi.includes(k) || voce(k).modello !== r.modello;
    }).map((r) => r.stato),
  );
  c(
    "«Cliente assente»: no_show e non_fatto sono UNA chiave",
    ["stato:no_show", "stato:no_show"],
    ["no_show", "non_fatto"].map((stato) => K.chiaveDi({ tipo: "ricontatto", stato })),
  );
  c(
    "«Ricontatto fissato» è lo stato «da ricontattare»",
    "ricontatto_fissato",
    K.chiaveDi({ tipo: "ricontatto", stato: "da_ricontattare" }),
  );
  c(
    "uno stato senza messaggio non ha chiave",
    [null, null],
    [
      K.chiaveDi({ tipo: "ricontatto", stato: "non_interessato" }),
      K.chiaveDi({ tipo: "ricontatto", stato: "da_contattare" }),
    ],
  );
  c(
    "nessun modello del riquadro manca dal catalogo",
    [],
    V.STATI_RIQUADRO.filter((r) => !K.CATALOGO.some((v) => v.modello === r.modello)).map(
      (r) => r.modello,
    ),
  );
  c(
    "«Lead nuovo»: i modelli del riquadro del primo contatto e del richiamo sono nel catalogo",
    [],
    [
      "hgl_primo_contatto",
      "hgl_richiamo_24h",
      "hgl_ritorno",
      "hgl_casi_reali",
      "hgl_meet_oggi",
      "hgl_meet_domani",
      "hgl_meet_adesso",
    ].filter((m) => !K.CATALOGO.some((v) => v.modello === m || v.variante === m)),
  );

  gruppo("MESSAGGI AUTOMATICI · CHI NON SI PUÒ ACCENDERE");
  const giro = leggi("src/crm/manychat/giro.ts");
  const regole = leggi("src/crm/manychat/regole.ts");
  const costante = (testo, nome) =>
    new RegExp(`export const ${nome} = (true|false);`).exec(testo)?.[1];
  const bloccate = K.CATALOGO.filter((v) => v.bloccataDalCodice).map((v) => v.chiave);
  c(
    "le costanti nel sorgente si leggono",
    ["false", "false"],
    [costante(giro, "MEET_ADESSO_ACCESO"), costante(regole, "PROMEMORIA_ACCONTO_ACCESO")],
  );
  c(
    "bloccate dal codice = le due costanti ancora false (se una torna vera, la voce non è più bloccata)",
    [
      costante(giro, "MEET_ADESSO_ACCESO") === "false",
      costante(regole, "PROMEMORIA_ACCONTO_ACCESO") === "false",
    ],
    [bloccate.includes("meet_adesso"), bloccate.includes("stato:in_attesa_acconto")],
  );
  c("nessun'altra voce è bloccata", 2, bloccate.length);

  gruppo("MESSAGGI AUTOMATICI · LA MIGRAZIONE (TESTO)");
  const FILE = "supabase/migrations/20261031160000_messaggi_automatici.sql";
  c("la migrazione esiste col nome del piano", true, existsSync(join(radice, FILE)));
  const grezzo = existsSync(join(radice, FILE)) ? leggi(FILE) : "";
  const sql = senzaCommenti(grezzo);
  const alto = sql.toUpperCase();
  //  L'unico ALTER ammesso: accendere la RLS sulle due tabelle NUOVE.
  const altro = alto.replace(
    /ALTER TABLE PUBLIC\.MESSAGGI_AUTOMATICI(_REGISTRO)? ENABLE ROW LEVEL SECURITY/g,
    "",
  );
  c(
    "solo aggiunte: niente ALTER (salvo la RLS delle due tabelle nuove), DROP, DELETE, TRUNCATE fuori dai commenti",
    [false, false, false, false],
    [
      /\bALTER\b/.test(altro),
      /\bDROP\b/.test(altro),
      /\bDELETE\b/.test(altro),
      /\bTRUNCATE\b/.test(altro),
    ],
  );
  c(
    "…e il «come si annulla» c'è, ma solo nel commento",
    [true, true],
    [/COME SI ANNULLA/i.test(grezzo), /--\s*DROP /.test(grezzo)],
  );
  c(
    "due tabelle nuove, con IF NOT EXISTS (si può rilanciare)",
    [true, true],
    ["messaggi_automatici", "messaggi_automatici_registro"].map((t) =>
      new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${t}\\b`, "i").test(sql),
    ),
  );
  c(
    "il registro porta chiave e acceso_dal (l'istante dell'ultima accensione)",
    [true, true, true],
    [
      /chiave\s+text\s+PRIMARY KEY/i.test(sql),
      /acceso\s+boolean\s+NOT NULL DEFAULT false/i.test(sql),
      /acceso_dal\s+timestamptz/i.test(sql),
    ],
  );
  c(
    "il log: chi (testo preso dal server), prima, dopo, quando",
    [true, true, true, true],
    [
      /\bprima\s+boolean/i.test(sql),
      /\bdopo\s+boolean/i.test(sql),
      /\bda\s+text/i.test(sql),
      /\bil\s+timestamptz\s+NOT NULL DEFAULT now\(\)/i.test(sql),
    ],
  );
  c(
    "tabelle CHIUSE: RLS accesa, tolto tutto ad anon e authenticated, dato al server",
    [true, true, true, true, true, true],
    ["messaggi_automatici", "messaggi_automatici_registro"].flatMap((t) => [
      new RegExp(`ALTER TABLE public\\.${t} ENABLE ROW LEVEL SECURITY`, "i").test(grezzo),
      new RegExp(`REVOKE ALL ON TABLE public\\.${t} FROM PUBLIC, anon, authenticated`, "i").test(
        sql,
      ),
      new RegExp(`GRANT ALL ON TABLE public\\.${t} TO service_role`, "i").test(sql),
    ]),
  );
  c(
    "nessuna policy: nessuno, tranne il server, tocca queste tabelle",
    false,
    /CREATE POLICY/i.test(sql),
  );

  gruppo("MESSAGGI AUTOMATICI · LA FUNZIONE «IMPOSTA» (COMPARE-AND-SET)");
  const da = sql.indexOf("FUNCTION public.messaggio_automatico_imposta(");
  const corpo = da < 0 ? "" : sql.slice(da, sql.indexOf("$$;", sql.indexOf("AS $$", da)) + 3);
  c(
    "la funzione c'è, con quattro argomenti e ritorna boolean",
    true,
    /messaggio_automatico_imposta\(\s*p_chiave\s+text,\s*p_prima\s+boolean,\s*p_dopo\s+boolean,\s*p_da\s+text\s*\)\s*RETURNS boolean/i.test(
      corpo,
    ),
  );
  c(
    "è SECURITY DEFINER con il percorso fissato",
    true,
    /SECURITY DEFINER SET search_path = public/i.test(corpo),
  );
  c(
    "cambia solo SE lo stato è ancora quello che chi clicca ha visto (WHERE acceso = prima)",
    true,
    /WHERE\s+chiave = p_chiave\s+AND\s+acceso = p_prima/i.test(corpo),
  );
  c(
    "acceso_dal si rimette solo nel passaggio spento → acceso",
    true,
    /acceso_dal = CASE WHEN p_dopo AND NOT acceso THEN now\(\) ELSE acceso_dal END/i.test(corpo),
  );
  c(
    "il log si scrive nella STESSA funzione, dopo aver toccato una riga; zero righe = false e niente log",
    [true, true, true],
    [
      /GET DIAGNOSTICS/i.test(corpo),
      corpo.indexOf("INSERT INTO public.messaggi_automatici_registro") >
        corpo.indexOf("UPDATE public.messaggi_automatici"),
      /IF v_righe = 0 THEN\s+RETURN false;/i.test(corpo),
    ],
  );
  c(
    "la funzione non la chiama nessuno tranne il server",
    [true, true],
    [
      /REVOKE ALL ON FUNCTION public\.messaggio_automatico_imposta\(text, boolean, boolean, text\) FROM PUBLIC, anon, authenticated/i.test(
        sql,
      ),
      /GRANT EXECUTE ON FUNCTION public\.messaggio_automatico_imposta\(text, boolean, boolean, text\) TO service_role/i.test(
        sql,
      ),
    ],
  );

  gruppo("MESSAGGI AUTOMATICI · IL SEME (LE STESSE REGOLE DI LETTURA DEL CODICE)");
  const seme = chiaviDelSeme(sql);
  c("le 25 chiavi del seme = quelle del catalogo", [...chiavi].sort(), [...seme].sort());
  c("il seme non ripete una chiave", seme.length, new Set(seme).size);
  c(
    "il seme non riscrive mai una riga che c'è già (ON CONFLICT DO NOTHING)",
    true,
    /ON CONFLICT \(chiave\) DO NOTHING/i.test(sql),
  );
  c(
    "gli stati si leggono come il codice: NULLIF(…,'') e un testo vero, non l'operatore «?» (che direbbe «acceso» anche per un valore vuoto)",
    [true, false],
    [/NULLIF\(/i.test(sql), /stati\s*\?|\?\s*'|jsonb_exists/.test(sql)],
  );
  c(
    "gli interruttori booleani si leggono con IS TRUE (colonna mancante o nulla = spento)",
    true,
    /IS TRUE/.test(sql),
  );
  c(
    "meet_adesso e acconto: spenti (sono costanti nel codice)",
    [true, true],
    ["meet_adesso", "stato:in_attesa_acconto"].map((k) =>
      new RegExp(`\\('${k}',\\s*false,\\s*NULL::timestamptz\\)`).test(sql),
    ),
  );
  c(
    "il webinar: acceso (oggi parte sempre)",
    true,
    /\('webinar_in_diretta',\s*true,\s*NULL::timestamptz\)/.test(sql),
  );
  c(
    "il valore storto non fa fallire la migrazione: le conversioni passano da funzioni con EXCEPTION",
    [true, true],
    [/FUNCTION pg_temp\.hgl_ts\(/.test(sql), /EXCEPTION WHEN others THEN/.test(sql)],
  );
  c(
    "colonna o tabella che manca = spento (la riga di manychat_config si legge come JSON)",
    [true, true],
    [/to_regclass\('public\.manychat_config'\)/.test(sql), /to_jsonb\(/.test(sql)],
  );
  c(
    "«Cliente assente» (no_show) si accende solo se lo sono anche non_fatto",
    [true, true],
    [
      /v_as := pg_temp\.hgl_stato\(m, 'no_show'\) IS NOT NULL AND pg_temp\.hgl_stato\(m, 'non_fatto'\) IS NOT NULL;/.test(
        sql,
      ),
      /\('stato:no_show', v_as,/.test(sql),
    ],
  );
  c(
    "conferma, fattura e prenota in chat si leggono da app_config: acceso = true esatto",
    [true, true, true],
    ["promemoria_whatsapp", "dati_fattura_config", "prenota_chat"].map((k) =>
      sql.includes(`'${k}'`),
    ),
  );
  c(
    "nessun dato dei clienti nel file (telefoni, email)",
    false,
    /\+39|@[a-z0-9-]+\.[a-z]{2,}|\b3\d{9}\b/i.test(grezzo),
  );

  gruppo("MESSAGGI AUTOMATICI · GLI SCRIPT A PARTE (supabase/recuperi)");
  const RIALLINEA = "supabase/recuperi/20261031_messaggi_automatici_riallinea.sql";
  const RIPRISTINA = "supabase/recuperi/20261031_messaggi_automatici_ripristina.sql";
  const CONTROLLO = "supabase/recuperi/20261031_messaggi_automatici_controllo.sql";
  for (const f of [RIALLINEA, RIPRISTINA, CONTROLLO])
    c(`${f.split("/").pop()} esiste`, true, existsSync(join(radice, f)));
  const riallinea = existsSync(join(radice, RIALLINEA)) ? leggi(RIALLINEA) : "";
  const ripristina = existsSync(join(radice, RIPRISTINA)) ? leggi(RIPRISTINA) : "";
  const controllo = existsSync(join(radice, CONTROLLO)) ? leggi(CONTROLLO) : "";
  const sRia = senzaCommenti(riallinea);
  const sRip = senzaCommenti(ripristina);
  const sCon = senzaCommenti(controllo);
  c(
    "nessuno dei tre cancella o cambia la forma di una tabella",
    [false, false, false],
    [sRia, sRip, sCon].map((s) => /\b(DROP|DELETE|TRUNCATE|ALTER)\b/i.test(s)),
  );
  c(
    "le regole di lettura sono IDENTICHE nel seme, in «riallinea» e in «controllo» (un solo testo copiato, provato qui)",
    [true, true, true],
    [
      bloccoVecchi(sql) !== "",
      bloccoVecchi(sRia) === bloccoVecchi(sql),
      bloccoVecchi(sCon) === bloccoVecchi(sql),
    ],
  );
  c(
    "«riallinea» riscrive il registro dai vecchi valori (UPDATE) e non crea né toglie righe",
    [true, false],
    [/UPDATE public\.messaggi_automatici\b/i.test(sRia), /INSERT INTO|DELETE/i.test(sRia)],
  );
  c(
    "«riallinea» non scrive il log delle modifiche (non è un cambio fatto da una persona)",
    false,
    /messaggi_automatici_registro/i.test(sRia),
  );
  c(
    "«ripristina» rimette le colonne vecchie e i JSON, e non tocca il registro",
    [true, true, true, true, false],
    [
      /UPDATE public\.manychat_config/i.test(sRip),
      /app_config/i.test(sRip),
      /lead_nuovo_dal/i.test(sRip),
      /stati\s*=/i.test(sRip),
      /UPDATE public\.messaggi_automatici\b/i.test(sRip),
    ],
  );
  c(
    "«controllo» è una SELECT: non scrive niente",
    [true, false],
    [/\bSELECT\b/i.test(sCon), /\b(INSERT|UPDATE|DELETE)\b/i.test(sCon)],
  );
  c(
    "«controllo» mette in colonna vecchio e registro per tutte le chiavi, e segnala no_show a parte",
    [true, true, true],
    [/vecchio/i.test(sCon), /registro/i.test(sCon), /no_show/i.test(sCon)],
  );
}
