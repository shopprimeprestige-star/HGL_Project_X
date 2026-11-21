/** ── SHOP R2 · T41 · LA MIGRAZIONE S4 (PAGAMENTI E ORDINI): TESTO SQL ────────────────────────────────────
 *  Qui NON gira un Postgres: si legge il testo di `20261122120000_shop_pagamenti.sql` con i COMMENTI TOLTI, e si distingue il testo
 *  FUORI dai corpi delle funzioni (`$$ … $$`) da quello DENTRO (consiglio C3: così la prova non è rossa per la ragione sbagliata).
 *  Il comportamento vero sta in `prove/sql/shop-pagamenti.sql` (Postgres usa-e-getta, condizione di merge). La applica il TITOLARE.
 *  Cosa deve valere (PIANO-R2 §4, T41):
 *   · controllo iniziale di M1 PRIMA di ogni scrittura; viene dopo S1, D40 e M1;
 *   · mai DELETE, DROP, TRUNCATE (corpi compresi), mai CREATE TRIGGER (sta in S4b), nessun CREATE POLICY;
 *   · nessun UPDATE … SET fuori dai corpi; dentro i corpi solo sulle tabelle del R2 e su `shop_orders`;
 *   · le colonne di `shop_orders` sono quelle (e i default) che il finto di T40 conosce, tutte `ADD COLUMN IF NOT EXISTS`, nessuna NOT NULL;
 *   · le 5 tabelle chiuse: protezione per riga, `REVOKE ALL … FROM … service_role`, solo SELECT a service_role;
 *   · le 12 funzioni: nomi e parametri `p_…` del finto, SECURITY DEFINER SET search_path = public, REVOKE/GRANT, blocco di riga dove serve,
 *     errori col nome e il SQLSTATE del finto; «pagato» nasce in UNA sola funzione; i tre semi; `ON CONFLICT … DO UPDATE` nel limite. */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { COLONNE_S4, COLONNE_CREA, CHIUSE, ERRORI_SQL, ERRORI_SQL_R2, FUNZIONI_R2, STATI_PAGAMENTO } from "./_finto-db.mjs";

const FILE = "20261122120000_shop_pagamenti.sql";
const PRECEDENTI = ["20261117120000_ecommerce_ordini.sql", "20261120120000_shop_catalogo.sql", "20261121120000_shop_invisible_derm.sql"];
const senzaCommenti = (sql) => sql.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--[^\n]*/g, "").replace(/[ \t]+\n/g, "\n");
const piatto = (s) => s.replace(/\s+/g, " ").trim();

/** Le funzioni di S4, col loro elenco di parametri `p_…` (il contratto del finto di T40, scritto accanto a ciascuna nel blocco «RILASCIO 2»). */
const PARAMETRI = {
  shop_ordine_crea: ["p_ordine", "p_riservati"],
  shop_ordine_sessione_registra: ["p_ordine", "p_sessione"],
  shop_ordine_pagato: ["p_ordine", "p_sessione", "p_importo_cent", "p_valuta", "p_metodo", "p_pagamento_id"],
  shop_ordine_chiudi: ["p_ordine", "p_sessione", "p_stato"],
  shop_ordine_riapri: ["p_ordine", "p_nuova_scade"],
  shop_stripe_evento_registra: ["p_id", "p_tipo", "p_ordine"],
  shop_stripe_evento_chiudi: ["p_id", "p_esito"],
  shop_rimborso_prenota: ["p_ordine", "p_importo_cent", "p_motivo", "p_chiave", "p_chi"],
  shop_rimborso_riconcilia: ["p_ordine", "p_rimborsi", "p_chiudi_orfane"],
  shop_ordine_giacenza_rimetti: ["p_ordine", "p_chi"],
  shop_limite_consuma: ["p_chiave", "p_finestra_s", "p_max"],
  shop_cassa_righe: ["p_skus"],
};
/** Le tabelle su cui un corpo può fare UPDATE (PIANO-R2 T41). */
const UPDATE_AMMESSI = ["shop_orders", "shop_rimborsi", "shop_stripe_sessioni", "shop_stripe_eventi", "shop_limiti"];
/** Le funzioni che toccano una riga d'ordine: devono prenderla con `FOR UPDATE` (D44: blocco di riga). */
const CON_BLOCCO = ["shop_ordine_sessione_registra", "shop_ordine_pagato", "shop_ordine_chiudi", "shop_ordine_riapri", "shop_rimborso_prenota", "shop_rimborso_riconcilia", "shop_ordine_giacenza_rimetti"];

export async function prove(mod, { c, gruppo, radice }) {
  gruppo("SHOP R2 · T41 · S4 PAGAMENTI E ORDINI: TESTO SQL, FUORI E DENTRO I CORPI (21/11/2026)");
  const percorso = join(radice, "supabase/migrations", FILE);
  c("la migrazione esiste col nome deciso (20261122120000_shop_pagamenti.sql) e viene dopo M1, S1 e D40", [true, true], [
    existsSync(percorso), PRECEDENTI.every((p) => FILE > p),
  ]);
  c("l'impalcatura SQL c'è: lo script di collaudo e il LEGGIMI che nomina i quattro collaudi (S4, S4b, S5, S6)", [true, true], [
    existsSync(join(radice, "prove/sql/shop-pagamenti.sql")),
    existsSync(join(radice, "prove/sql/LEGGIMI.md")) && ["shop-pagamenti.sql", "shop-orders-protezione.sql", "shop-spedizioni.sql", "shop-email.sql"].every((f) => readFileSync(join(radice, "prove/sql/LEGGIMI.md"), "utf8").includes(f)),
  ]);
  if (!existsSync(percorso)) return;

  const grezzo = readFileSync(percorso, "utf8");
  const sql = senzaCommenti(grezzo);
  const corpi = [...sql.matchAll(/\$\$([\s\S]*?)\$\$/g)].map((m) => m[1]);
  const fuori = sql.replace(/\$\$[\s\S]*?\$\$/g, () => "$$…$$");
  const stmt = fuori.split(";").map(piatto).filter(Boolean);
  const tuttoPiatto = piatto(sql);
  /** Il corpo di una funzione, dalla sua intestazione fino al `$$` che chiude. */
  const corpoDi = (nome) => new RegExp(`CREATE OR REPLACE FUNCTION public\\.${nome}\\(([\\s\\S]*?)\\)\\s*RETURNS[\\s\\S]*?AS \\$\\$([\\s\\S]*?)\\$\\$`).exec(sql);
  const nomi = Object.keys(PARAMETRI);

  /* ── prima di ogni scrittura: il controllo di M1 ── */
  const primoCambio = stmt.findIndex((s) => /^(CREATE|ALTER|INSERT|REVOKE|GRANT)\b/i.test(s));
  const controllo = stmt.findIndex((s) => /^DO \$\$…\$\$$/.test(s));
  c("il controllo iniziale è un blocco DO che viene PRIMA di qualunque CREATE, ALTER, INSERT, REVOKE, GRANT", true, controllo >= 0 && controllo < primoCambio);
  const corpoControllo = corpi.find((b) => /information_schema\.columns/.test(b)) ?? "";
  c("… guarda `shop_orders.pagato_il` (M1) e le tabelle di S1, e si ferma con un RAISE EXCEPTION chiaro che nomina la migrazione mancante", [true, true, true, true], [
    /table_name = 'shop_orders'/.test(corpoControllo) && /column_name = 'pagato_il'/.test(corpoControllo),
    ["shop_varianti", "shop_giacenza_movimenti", "shop_storico", "shop_impostazioni"].every((t) => corpoControllo.includes(t)),
    /RAISE EXCEPTION/.test(corpoControllo),
    /M1/.test(corpoControllo) && /20261117120000/.test(corpoControllo),
  ]);
  c("il corpo del controllo non scrive niente (nessun INSERT, UPDATE, CREATE, ALTER)", false, /\b(INSERT|UPDATE|CREATE|ALTER)\b/i.test(corpoControllo));

  /* ── solo aggiunte ── */
  c("nessun DELETE, DROP, TRUNCATE in nessun punto del file, corpi e stringhe compresi", [0, 0, 0], [/\bDELETE\b/i, /\bDROP\b/i, /\bTRUNCATE\b/i].map((r) => (sql.match(new RegExp(r.source, "gi")) || []).length));
  c("nessun CREATE TRIGGER (il trigger è di S4b: S4 da sola è inerte) e nessun CREATE POLICY (le tabelle nuove non hanno policy)", [0, 0], [
    (sql.match(/CREATE\s+(OR\s+REPLACE\s+)?(CONSTRAINT\s+)?TRIGGER/gi) || []).length, (sql.match(/CREATE\s+POLICY/gi) || []).length,
  ]);
  c("nessun UPDATE … SET FUORI dai corpi delle funzioni (nessun dato esistente si riscrive)", 0, (fuori.match(/\bUPDATE\b[^;]*\bSET\b/gi) || []).length);
  const bersagliUpdate = corpi.flatMap((b) => [...b.matchAll(/(?<!DO\s)\bUPDATE\s+(?:ONLY\s+)?(?:public\.)?([a-z_]+)/gi)].map((m) => m[1].toLowerCase())).filter((t) => t !== "set");
  c("DENTRO i corpi gli UPDATE toccano solo shop_orders, shop_rimborsi, shop_stripe_sessioni, shop_stripe_eventi, shop_limiti", [], [...new Set(bersagliUpdate)].filter((t) => !UPDATE_AMMESSI.includes(t)));
  c("… e ci sono davvero (la prova guarda qualcosa)", true, bersagliUpdate.length >= 8 && UPDATE_AMMESSI.filter((t) => t !== "shop_limiti").every((t) => bersagliUpdate.includes(t)));
  c("fuori dai corpi gli INSERT sono solo i tre semi di `shop_impostazioni` (ON CONFLICT DO NOTHING, mai riscritti)", true,
    stmt.filter((s) => /^INSERT\b/i.test(s)).length === 1 && /^INSERT INTO public\.shop_impostazioni \(chiave, valore\) VALUES .* ON CONFLICT \(chiave\) DO NOTHING$/.test(stmt.find((s) => /^INSERT\b/i.test(s)) ?? ""));
  const semi = stmt.find((s) => /^INSERT INTO public\.shop_impostazioni/.test(s)) ?? "";
  c("i tre semi: cassa_sito = «vecchia», pagamento_sicuro = false, metodi_pagamento = []", [true, true, true], [
    /\('cassa_sito', '"vecchia"'::jsonb\)/.test(semi), /\('pagamento_sicuro', 'false'::jsonb\)/.test(semi), /\('metodi_pagamento', '\[\]'::jsonb\)/.test(semi),
  ]);
  const altereFuori = stmt.filter((s) => /^ALTER TABLE\b/i.test(s));
  c("ALTER TABLE: solo `shop_orders ADD COLUMN IF NOT EXISTS` e la protezione per riga delle tabelle NUOVE; nessun altro oggetto già esistente si modifica", [], altereFuori.filter((s) =>
    !(/^ALTER TABLE public\.shop_orders (ADD COLUMN IF NOT EXISTS [^;]+)$/.test(s) || /^ALTER TABLE public\.(shop_ordini_riservati|shop_stripe_sessioni|shop_stripe_eventi|shop_rimborsi|shop_limiti) ENABLE ROW LEVEL SECURITY$/.test(s))));
  c("il file è dentro una transazione (BEGIN … COMMIT) e chiede a PostgREST di ricaricare lo schema, come S1", [true, true], [stmt.includes("BEGIN") && stmt.includes("COMMIT"), stmt.includes("NOTIFY pgrst, 'reload schema'")]);

  /* ── le colonne di shop_orders: le stesse del finto ── */
  const alter = altereFuori.find((s) => /^ALTER TABLE public\.shop_orders ADD COLUMN/.test(s)) ?? "";
  const colonne = Object.fromEntries([...alter.matchAll(/ADD COLUMN IF NOT EXISTS ([a-z_]+) (.+?)(?=, ADD COLUMN IF NOT EXISTS |$)/g)].map((m) => [m[1], m[2].trim()]));
  c("shop_orders: le colonne nuove sono ESATTAMENTE quelle del finto (COLONNE_S4), tutte `ADD COLUMN IF NOT EXISTS`", [[], []], [
    Object.keys(COLONNE_S4).filter((k) => !(k in colonne)), Object.keys(colonne).filter((k) => !(k in COLONNE_S4)),
  ]);
  c("nessun ADD COLUMN senza IF NOT EXISTS (rilanciabile)", 0, (sql.match(/ADD COLUMN(?! IF NOT EXISTS)/g) || []).length);
  c("nessuna colonna nuova è NOT NULL (nessuna riga esistente cambia)", [], Object.entries(colonne).filter(([, d]) => /NOT NULL/i.test(d)).map(([k]) => k));
  const defaultDi = (d) => { const m = /DEFAULT\s+('[^']*'(?:::jsonb)?|false|true|[0-9]+)/i.exec(d); if (!m) return null; const v = m[1]; return v === "false" ? false : v === "true" ? true : /^[0-9]+$/.test(v) ? Number(v) : JSON.parse(v.replace(/^'|'(::jsonb)?$/g, "")); };
  const attesiDefault = Object.entries(COLONNE_S4).filter(([, v]) => v !== null);
  c("i default sono quelli che il finto dà a una riga VECCHIA (prova false, rimborsato_cent 0, riprova_n 0, giacenza_da_verificare false, fattura_richiesta false, email_inviate {}, avvisi [])",
    JSON.stringify(attesiDefault), JSON.stringify(Object.keys(COLONNE_S4).filter((k) => defaultDi(colonne[k] ?? "") !== null).map((k) => [k, defaultDi(colonne[k])])));
  c("le colonne senza default nel finto non ne hanno nel SQL (vuote sulle righe vecchie)", [], Object.entries(COLONNE_S4).filter(([k, v]) => v === null && defaultDi(colonne[k] ?? "") !== null).map(([k]) => k));
  const tipi = Object.fromEntries(Object.entries(colonne).map(([k, d]) => [k, d.split(/\s+/)[0].toLowerCase()]));
  c("i tipi: importi in centesimi interi, date timestamptz, email_inviate/avvisi jsonb, flag boolean", [true, true, true, true], [
    ["totale_cent", "rimborsato_cent", "riprova_n"].every((k) => tipi[k] === "integer"),
    ["scade_il", "giacenza_scalata_il", "giacenza_rimessa_il", "spedito_il", "annullato_il", "fattura_emessa_il"].every((k) => tipi[k] === "timestamptz"),
    tipi.email_inviate === "jsonb" && tipi.avvisi === "jsonb",
    ["prova", "giacenza_da_verificare", "senza_tracking", "fattura_richiesta"].every((k) => tipi[k] === "boolean"),
  ]);
  const elencoStati = (/stato_pagamento text CHECK \(stato_pagamento IS NULL OR stato_pagamento = '' OR stato_pagamento IN \(([^)]*)\)\)/.exec(alter)?.[1] ?? "").split(",").map((x) => x.trim().replace(/'/g, "")).filter(Boolean);
  c("stato_pagamento ha il CHECK: vuoto, oppure uno dei sette stati di D41 (quelli del finto)", JSON.stringify([...STATI_PAGAMENTO].sort()), JSON.stringify([...elencoStati].sort()));
  c("rimborsato_cent e totale_cent non possono essere negativi (CHECK)", [true, true], [/rimborsato_cent integer DEFAULT 0 CHECK \(rimborsato_cent >= 0\)/.test(alter), /totale_cent integer CHECK \(totale_cent IS NULL OR totale_cent >= 0\)/.test(alter)]);
  const indici = stmt.filter((s) => /^CREATE (UNIQUE )?INDEX\b/i.test(s));
  c("indici: sessione corrente unica (parziale), order_ref unico SOLO dove canale = 'sito', stato_pagamento; tutti IF NOT EXISTS", [true, true, true, true], [
    indici.some((s) => /^CREATE UNIQUE INDEX IF NOT EXISTS \S+ ON public\.shop_orders \(stripe_sessione_id\) WHERE stripe_sessione_id IS NOT NULL$/.test(s)),
    indici.some((s) => /^CREATE UNIQUE INDEX IF NOT EXISTS \S+ ON public\.shop_orders \(order_ref\) WHERE canale = 'sito'$/.test(s)),
    indici.some((s) => /^CREATE INDEX IF NOT EXISTS \S+ ON public\.shop_orders \(stato_pagamento\)/.test(s)),
    indici.every((s) => /IF NOT EXISTS/.test(s)),
  ]);

  /* ── le cinque tabelle chiuse ── */
  const chiuse = [...CHIUSE];
  c("le cinque tabelle chiuse sono quelle del finto e ognuna è `CREATE TABLE IF NOT EXISTS`", [[], []], [
    chiuse.filter((t) => !new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${t} \\(`).test(sql)),
    [...sql.matchAll(/CREATE TABLE(?: IF NOT EXISTS)? public\.([a-z_]+)/g)].map((m) => m[1]).filter((t) => !chiuse.includes(t)),
  ]);
  c("ognuna ha la protezione per riga accesa", [], chiuse.filter((t) => !stmt.includes(`ALTER TABLE public.${t} ENABLE ROW LEVEL SECURITY`)));
  c("ognuna: REVOKE ALL … FROM PUBLIC, anon, authenticated, service_role (nessuna scrittura diretta, nemmeno col ruolo del server)", [], chiuse.filter((t) => !stmt.includes(`REVOKE ALL ON TABLE public.${t} FROM PUBLIC, anon, authenticated, service_role`)));
  c("… poi al solo service_role il SELECT (il CRM legge, non scrive)", [[], 0], [
    chiuse.filter((t) => !stmt.includes(`GRANT SELECT ON TABLE public.${t} TO service_role`)),
    stmt.filter((s) => /^GRANT (ALL|INSERT|UPDATE)\b.*\bON TABLE\b/i.test(s)).length,
  ]);
  c("il REVOKE viene PRIMA del GRANT SELECT, per ogni tabella chiusa", [], chiuse.filter((t) => stmt.indexOf(`REVOKE ALL ON TABLE public.${t} FROM PUBLIC, anon, authenticated, service_role`) > stmt.indexOf(`GRANT SELECT ON TABLE public.${t} TO service_role`)));
  const tabella = (t) => new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${t} \\(([\\s\\S]*?)\\n\\);`).exec(sql)?.[1] ?? "";
  c("shop_rimborsi: importo > 0, motivo non vuoto, stato e origine con valori fissi, stripe_rimborso_id e chiave_richiesta UNICI", [true, true, true, true, true, true], [
    /importo_cent\s+integer NOT NULL CHECK \(importo_cent > 0\)/.test(tabella("shop_rimborsi")),
    /motivo\s+text NOT NULL CHECK \(btrim\(motivo\) <> ''\)/.test(tabella("shop_rimborsi")),
    /stato\s+text NOT NULL DEFAULT 'richiesto' CHECK \(stato IN \('richiesto', 'riuscito', 'fallito'\)\)/.test(tabella("shop_rimborsi")),
    /origine\s+text NOT NULL DEFAULT 'crm' CHECK \(origine IN \('crm', 'stripe'\)\)/.test(tabella("shop_rimborsi")),
    /stripe_rimborso_id\s+text UNIQUE/.test(tabella("shop_rimborsi")), /chiave_richiesta\s+text UNIQUE/.test(tabella("shop_rimborsi")),
  ]);
  c("shop_stripe_sessioni: chiave primaria la sessione, stati fissi (aperta, pagata, doppia, scaduta, fallita); shop_stripe_eventi: chiave primaria l'id evt_…; shop_limiti: una riga per chiave", [true, true, true, true], [
    /sessione_id\s+text PRIMARY KEY/.test(tabella("shop_stripe_sessioni")),
    /stato\s+text NOT NULL DEFAULT 'aperta' CHECK \(stato IN \('aperta', 'pagata', 'doppia', 'scaduta', 'fallita'\)\)/.test(tabella("shop_stripe_sessioni")),
    /id\s+text PRIMARY KEY/.test(tabella("shop_stripe_eventi")),
    /chiave\s+text PRIMARY KEY/.test(tabella("shop_limiti")),
  ]);
  c("shop_ordini_riservati: un solo record per ordine (ordine_id chiave primaria) e i campi di D42; l'evento non ha chiave esterna sull'ordine (l'ordine può non esserci)", [true, true, true], [
    /ordine_id\s+uuid PRIMARY KEY REFERENCES public\.shop_orders \(id\)/.test(tabella("shop_ordini_riservati")),
    [["fattura", "jsonb"], ["attribuzione", "jsonb"], ["consensi", "jsonb"], ["ip", "text"], ["user_agent", "text"]].every(([k, tipo]) => new RegExp(`\\b${k}\\s+${tipo}\\b`).test(tabella("shop_ordini_riservati"))),
    !/REFERENCES/.test(tabella("shop_stripe_eventi")),
  ]);

  /* ── le 12 funzioni ── */
  const dichiarate = [...sql.matchAll(/CREATE OR REPLACE FUNCTION public\.([a-z_0-9]+)\(/g)].map((m) => m[1]);
  c("le 12 funzioni di S4 del finto ci sono tutte, ognuna una volta (più, al massimo, gli aiuti interni `shop_s4_…`)", [[], [], []], [
    FUNZIONI_R2.S4.filter((f) => !dichiarate.includes(f)), dichiarate.filter((f, i) => dichiarate.indexOf(f) !== i), dichiarate.filter((f) => !FUNZIONI_R2.S4.includes(f) && !f.startsWith("shop_s4_")),
  ]);
  c("l'elenco dei parametri di questa prova è lo stesso del finto (FUNZIONI_R2.S4)", JSON.stringify([...FUNZIONI_R2.S4].sort()), JSON.stringify(nomi.sort()));
  for (const n of nomi) {
    const m = corpoDi(n);
    const parametri = m ? [...m[1].matchAll(/\b(p_[a-z_]+)\s+/g)].map((x) => x[1]) : null;
    c(`${n}: i parametri sono ${PARAMETRI[n].join(", ")} (nomi `+"`p_…` e ordine del finto)", JSON.stringify(PARAMETRI[n]), JSON.stringify(parametri));
  }
  const tutteLeFunzioni = [...sql.matchAll(/CREATE OR REPLACE FUNCTION public\.([a-z_0-9]+)\([\s\S]*?\)\s*RETURNS[^$]*?AS \$\$/g)];
  c("ogni funzione è SECURITY DEFINER SET search_path = public", [], tutteLeFunzioni.filter((m) => !/SECURITY DEFINER SET search_path = public AS \$\$$/.test(m[0])).map((m) => m[1]));
  c("ogni funzione ha REVOKE ALL … FROM PUBLIC, anon, authenticated e GRANT EXECUTE … TO service_role (stessa firma)", [[], []], [
    dichiarate.filter((n) => !stmt.some((s) => new RegExp(`^REVOKE ALL ON FUNCTION public\\.${n}\\([^)]*\\) FROM PUBLIC, anon, authenticated$`).test(s))),
    dichiarate.filter((n) => !stmt.some((s) => new RegExp(`^GRANT EXECUTE ON FUNCTION public\\.${n}\\([^)]*\\) TO service_role$`).test(s))),
  ]);
  const grantBrowser = (sql.match(/GRANT[^;]*\bTO\b[^;]*\b(anon|authenticated|PUBLIC)\b/gi) || []).map(piatto);
  c("nessun GRANT ad anon o authenticated, tranne UNO: INSERT/UPDATE di COLONNA su shop_orders (le sole colonne di prima), fatto con EXECUTE format dentro un blocco DO", [1, true], [
    grantBrowser.length, /^GRANT INSERT \(%s\), UPDATE \(%s\) ON TABLE public\.shop_orders TO anon, authenticated$/.test(grantBrowser[0] ?? ""),
  ]);
  const doColonne = corpi.find((b) => /GRANT INSERT \(%s\)/.test(b)) ?? "";
  const escluse = [...(/attname <> ALL \(ARRAY\[([^\]]*)\]\)/.exec(doColonne)?.[1] ?? "").matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
  c("revisione di sicurezza: prima del GRANT di colonna c'è `REVOKE INSERT, UPDATE ON TABLE public.shop_orders FROM anon, authenticated`; il GRANT esclude ESATTAMENTE le 28 colonne nuove (quelle del finto)", [true, [], []], [
    stmt.indexOf("REVOKE INSERT, UPDATE ON TABLE public.shop_orders FROM anon, authenticated") >= 0 && stmt.indexOf("REVOKE INSERT, UPDATE ON TABLE public.shop_orders FROM anon, authenticated") < stmt.findIndex((s, i) => /^DO \$\$…\$\$$/.test(s) && i > controllo),
    Object.keys(COLONNE_S4).filter((k) => !escluse.includes(k)), escluse.filter((k) => !(k in COLONNE_S4)),
  ]);
  c("… e il blocco DO non tocca altro (nessun INSERT, UPDATE, CREATE; il solo GRANT è quello di colonna)", false, /\b(INSERT INTO|UPDATE\s+\w|CREATE|ALTER)\b/i.test(doColonne));

  /* ── blocco di riga, sotto-blocchi, un solo punto che paga ── */
  c("le funzioni che toccano un ordine lo prendono con `SELECT … FOR UPDATE` su shop_orders (D44: stato letto sotto blocco)", [], CON_BLOCCO.filter((n) => !/FROM public\.shop_orders[^;]*FOR UPDATE/.test(corpoDi(n)?.[2] ?? "")));
  const pagato = corpoDi("shop_ordine_pagato")?.[2] ?? "";
  c("`pagato_il` si scrive in UNA sola funzione: shop_ordine_pagato (D44)", [[], true], [
    nomi.filter((n) => n !== "shop_ordine_pagato" && /\bpagato_il\s*=/.test(corpoDi(n)?.[2] ?? "")), /\bpagato_il\s*=\s*now\(\)/.test(pagato),
  ]);
  c("shop_ordine_pagato paga SOLO da in_attesa, scaduto o fallito (nota a del revisore) e legge il totale in centesimi (`totale_cent`), mai in euro", [true, true], [
    /IN \('in_attesa', 'scaduto', 'fallito'\)/.test(pagato), /totale_cent/.test(pagato) && !/\btotal\b/.test(pagato),
  ]);
  c("shop_ordine_pagato scala la giacenza riga per riga con shop_giacenza_muovi, ognuna in un sotto-blocco BEGIN … EXCEPTION (mai un errore che butti la transazione)", [true, true, true], [
    /shop_giacenza_muovi\(/.test(pagato), /BEGIN\s+PERFORM public\.shop_giacenza_muovi\([^;]*;[\s\S]*?EXCEPTION WHEN OTHERS THEN[\s\S]*?END;/.test(pagato), /v_da_verificare := true/.test(pagato),
  ]);
  c("… e scrive gli avvisi di D44: sessione_sconosciuta, doppio_pagamento, importo_diverso, valuta_diversa, pagato_dopo_annullo, pagato_dopo_scadenza, giacenza_da_verificare", [], [
    "sessione_sconosciuta", "doppio_pagamento", "importo_diverso", "valuta_diversa", "pagato_dopo_annullo", "pagato_dopo_scadenza", "giacenza_da_verificare",
  ].filter((a) => !pagato.includes(`'${a}'`)));
  const rimetti = corpoDi("shop_ordine_giacenza_rimetti")?.[2] ?? "";
  c("shop_ordine_giacenza_rimetti legge SOLO i movimenti dell'ordine (ordine_ref, motivo 'ordine') ed è idempotente per giacenza_rimessa_il", [true, true, true], [
    /FROM public\.shop_giacenza_movimenti/.test(rimetti) && /motivo = 'ordine'/.test(rimetti) && /ordine_ref = /.test(rimetti), /giacenza_rimessa_il IS NOT NULL/.test(rimetti), /'annullo_ordine'/.test(rimetti),
  ]);
  const limite = corpoDi("shop_limite_consuma")?.[2] ?? "";
  c("shop_limite_consuma: INSERT … ON CONFLICT (chiave) DO UPDATE, atomica, a finestra scaduta riparte da 1 (nessun DELETE)", [true, true], [
    /INSERT INTO public\.shop_limiti AS \w+[\s\S]*ON CONFLICT \(chiave\) DO UPDATE SET/.test(limite), /THEN 1\b/.test(limite),
  ]);
  const crea = corpoDi("shop_ordine_crea")?.[2] ?? "";
  const colonneCrea = (/INSERT INTO public\.shop_orders \(([^)]*)\)/.exec(crea)?.[1] ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  c("shop_ordine_crea (nota d): le colonne che copia dal chiamante sono ESATTAMENTE la lista bianca del finto (COLONNE_CREA); le altre le decide la funzione", [[], [], true], [
    COLONNE_CREA.filter((k) => !colonneCrea.includes(k)), colonneCrea.filter((k) => !COLONNE_CREA.includes(k) && !["status", "stato_pagamento", "canale", "rimborsato_cent"].includes(k)),
    ["status", "stato_pagamento", "canale", "rimborsato_cent"].every((k) => colonneCrea.includes(k)) && /'nuovo', 'in_attesa', 'sito', 0/.test(crea),
  ]);
  c("shop_ordine_crea scrive l'ordine e i riservati nella stessa funzione e rilegge l'id prima (due volte lo stesso id → 'esistente')", [true, true, true], [
    /INSERT INTO public\.shop_ordini_riservati/.test(crea), /'esistente'/.test(crea), /ON CONFLICT \(id\) DO NOTHING/.test(crea),
  ]);
  c("shop_ordine_crea (revisione di sicurezza): «esistente» solo se la riga è la STESSA (canale 'sito', order_ref, email, totale_cent); altrimenti ordine_id_gia_usato", [true, true, true, true, true], [
    /canale = 'sito'/.test(crea), /order_ref IS NOT DISTINCT FROM/.test(crea), /email IS NOT DISTINCT FROM/.test(crea), /totale_cent IS NOT DISTINCT FROM/.test(crea),
    /RAISE EXCEPTION 'ordine_id_gia_usato' USING ERRCODE = 'unique_violation'/.test(crea),
  ]);
  const prenota = corpoDi("shop_rimborso_prenota")?.[2] ?? "";
  c("shop_rimborso_prenota: massimo = pagato − (richiesto + riuscito) sotto blocco, e la chiave già usata da un ALTRO ordine è rifiutata (nota f)", [true, true, true], [
    /stato IN \('richiesto', 'riuscito'\)/.test(prenota), /rimborso_oltre_pagato/.test(prenota), /rimborso_chiave_altro_ordine/.test(prenota),
  ]);
  const cassa = corpoDi("shop_cassa_righe")?.[2] ?? "";
  c("shop_cassa_righe: sku, slug, nome, nome_variante, prezzo_cent, attiva, pubblicato, giacenza (l'unica lettura della giacenza fuori dal CRM)", [], [
    "sku", "slug", "nome", "nome_variante", "prezzo_cent", "attiva", "pubblicato", "giacenza",
  ].filter((k) => !cassa.includes(`'${k}'`)));
  const riapri = corpoDi("shop_ordine_riapri")?.[2] ?? "";
  c("shop_ordine_riapri: incrementa riprova_n sotto blocco, un annullato non si riapre (nota b)", [true, true], [/riprova_n = COALESCE\(riprova_n, 0\) \+ 1/.test(riapri), /status = 'annullato'/.test(riapri)]);
  const chiudi = corpoDi("shop_ordine_chiudi")?.[2] ?? "";
  c("shop_ordine_chiudi: chiude SOLO da in_attesa e ignora la sessione che non è dell'ordine (nota c)", [true, true], [/stato_pagamento IS DISTINCT FROM 'in_attesa'/.test(chiudi), /'ignorato'/.test(chiudi)]);

  /* ── gli errori: nome e SQLSTATE del finto ── */
  const noti = { ...ERRORI_SQL, ...ERRORI_SQL_R2 };
  const raise = corpi.flatMap((b) => [...b.matchAll(/RAISE EXCEPTION '([a-z_]+)' USING ERRCODE = '([a-z_]+)'/g)].map((m) => [m[1], m[2]]));
  c("ogni RAISE EXCEPTION dei corpi usa un nome del finto e lo stesso ERRCODE (tranne il controllo iniziale, che ha una frase)", [], raise.filter(([n, e]) => !noti[n] || noti[n].errcode !== e));
  const usati = new Set(raise.map(([n]) => n));
  c("gli errori del contratto per S4 ci sono tutti (non ne manca uno)", [], ["ordine_non_trovato", "ordine_non_valido", "parametro_non_valido", "ordine_non_riapribile", "ordine_non_pagato", "stato_non_valido", "rimborso_importo_non_valido", "rimborso_oltre_pagato", "rimborso_chiave_altro_ordine", "sessione_di_un_altro_ordine", "ordine_id_gia_usato", "limite_non_valido"].filter((n) => !usati.has(n)));
  c("la frase del controllo iniziale NON contiene parole che i controlli «mai DELETE/DROP» possano scambiare per comandi (la prova sopra ha già letto tutto il file)", true, !/\b(DELETE|DROP|TRUNCATE)\b/i.test(tuttoPiatto));
}
