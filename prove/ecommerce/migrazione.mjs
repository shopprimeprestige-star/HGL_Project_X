/** ── E-COMMERCE · T2 · LA MIGRAZIONE M1, LO SCRIPT M2 E I TIPI (TESTO SQL) ─────
 *  Qui NON gira un Postgres: si legge il testo di `20261117120000_ecommerce_ordini.sql` (M1) e di
 *  `supabase/ORDINI-SOLO-SERVER.sql` (M2), i COMMENTI SI TOLGONO prima, e si confrontano con il
 *  checkout (che campi manda) e con `types.ts`. Il comportamento vero (doppia applicazione, anonimo che
 *  prova `pagato_il` o un `created_at` di ieri) è `prove/sql/ecommerce-ordini.sql` su un Postgres
 *  usa-e-getta: mai sul database di produzione. Dati: nessuno, né nomi né numeri. */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const M1 = "20261117120000_ecommerce_ordini.sql";
const ORIGINALE = "20260722160000_shop_orders.sql";
const M2 = "ORDINI-SOLO-SERVER.sql";
const POLICY_NUOVA = "shop_orders_insert_checkout";
const POLICY_VECCHIA = "anyone can insert shop order";

/** Colonne nuove di shop_orders (PIANO §3.1) e il loro tipo. */
const COLONNE = {
  lead_id: "UUID",
  senza_lead: "BOOLEAN DEFAULT false",
  pagato_il: "TIMESTAMPTZ",
  pagato_importo: "NUMERIC",
  metodo_pagamento: "TEXT",
  tracking: "TEXT",
  note_interne: "TEXT",
  aggiornato_il: "TIMESTAMPTZ",
};
const COLONNE_EVENTI = ["id", "created_at", "order_id", "order_ref", "tipo", "chi", "prima", "dopo"];

const senzaCommenti = (sql) =>
  sql.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--[^\n]*/g, "").replace(/[ \t]+\n/g, "\n");
/** Il testo su una riga sola, spazi normalizzati: per i confronti. */
const piatto = (s) => s.replace(/\s+/g, " ").trim();
/** Le istruzioni (separate da `;`) del file senza commenti. */
const istruzioni = (sql) => senzaCommenti(sql).split(";").map(piatto).filter(Boolean);

export async function prove(_mod, { c, gruppo, radice }) {
  gruppo("E-COMMERCE · M1/M2 E TIPI: TESTO SQL (17/11/2026)");
  const cartella = join(radice, "supabase/migrations");
  const pM1 = join(cartella, M1);
  const pM2 = join(radice, "supabase", M2);
  c("M1 esiste col nome del piano; M2 esiste fuori da migrations/", [true, true, false], [
    existsSync(pM1),
    existsSync(pM2),
    existsSync(join(cartella, M2)),
  ]);
  if (!existsSync(pM1) || !existsSync(pM2)) return;

  const grezzo = readFileSync(pM1, "utf8");
  const sql = senzaCommenti(grezzo);
  const tutto = piatto(sql);
  const stmt = istruzioni(grezzo);

  /* ── solo aggiunte ── */
  const ammessa = (s) =>
    /^(BEGIN|COMMIT)$/.test(s) ||
    /^NOTIFY pgrst, 'reload schema'$/.test(s) ||
    /^CREATE INDEX IF NOT EXISTS \w+ ON public\.\w+ \(/.test(s) ||
    /^CREATE TABLE IF NOT EXISTS public\.shop_order_eventi \(/.test(s) ||
    /^ALTER TABLE public\.shop_order_eventi ENABLE ROW LEVEL SECURITY$/.test(s) ||
    /^CREATE POLICY "shop_orders_insert_checkout" ON public\.shop_orders FOR INSERT WITH CHECK \(/.test(s) ||
    /^DROP POLICY IF EXISTS "(shop_orders_insert_checkout|anyone can insert shop order)" ON public\.shop_orders$/.test(s) ||
    (/^ALTER TABLE public\.shop_orders ADD COLUMN IF NOT EXISTS /.test(s) &&
      s.split(/,\s*(?=ADD COLUMN)/).every((p) => /^(ALTER TABLE public\.shop_orders )?ADD COLUMN IF NOT EXISTS \w+ /.test(p)));
  c("ogni istruzione di M1 è tra quelle ammesse (solo aggiunte, policy nuova/vecchia, NOTIFY, BEGIN/COMMIT)", [], stmt.filter((s) => !ammessa(s)));
  c(
    "nessun DROP TABLE|COLUMN|INDEX|FUNCTION, TRUNCATE, DELETE, UPDATE, ALTER COLUMN, RENAME, GRANT/REVOKE",
    [0, 0, 0, 0, 0, 0, 0, 0],
    [
      /DROP\s+(TABLE|COLUMN|INDEX|FUNCTION|SCHEMA)/i,
      /\bTRUNCATE\b/i,
      /\bDELETE\b/i,
      /\bUPDATE\b/i,
      /ALTER\s+COLUMN/i,
      /\bRENAME\b/i,
      /\b(GRANT|REVOKE)\b/i,
      /\bINSERT\s+INTO\b/i,
    ].map((r) => (r.test(sql) ? 1 : 0)),
  );
  c("l'unico DROP è quello delle due policy attese (la nuova per rilanciarla, la vecchia larga)", [POLICY_NUOVA, POLICY_VECCHIA].sort(),
    [...sql.matchAll(/DROP\s+(\w+)\s+IF EXISTS\s+"([^"]+)"/gi)].map((m) => (m[1].toUpperCase() === "POLICY" ? m[2] : `?${m[1]}`)).sort());
  c("ogni CREATE TABLE/INDEX ha IF NOT EXISTS; ogni ADD COLUMN ha IF NOT EXISTS", [0, 0, 0], [
    (tutto.match(/CREATE TABLE (?!IF NOT EXISTS)/g) ?? []).length,
    (tutto.match(/CREATE INDEX (?!IF NOT EXISTS)/g) ?? []).length,
    (tutto.match(/ADD COLUMN (?!IF NOT EXISTS)/g) ?? []).length,
  ]);
  c("M1 non nomina crm_leads, whatsapp_*, public_leads (solo shop_orders e shop_order_eventi)", [], [...new Set([...tutto.matchAll(/public\.(\w+)/g)].map((m) => m[1]))].filter((t) => !["shop_orders", "shop_order_eventi"].includes(t)));
  c("nessuna chiave, nessun indirizzo, nessun segreto nel testo", false, /https?:\/\/|eyJ|sbp_|service_role/i.test(grezzo));

  /* ── le colonne di §3.1 ── */
  for (const [nome, tipo] of Object.entries(COLONNE)) {
    c(`colonna ${nome}: ADD COLUMN IF NOT EXISTS ${tipo}`, true, new RegExp(`ADD COLUMN IF NOT EXISTS ${nome}\\s+${tipo.replace(/ /g, "\\s+")}\\s*[,;]`).test(sql + ";"));
  }
  c("le colonne aggiunte sono esattamente queste otto (nessuna in più)", Object.keys(COLONNE).sort(),
    [...tutto.matchAll(/ADD COLUMN IF NOT EXISTS (\w+)/g)].map((m) => m[1]).sort());
  c("collegato_il e collegato_da NON ci sono (tolte dal piano v2)", false, /collegato_(il|da)/.test(grezzo));
  c("nessun vincolo su order_ref (niente UNIQUE), nessuna chiave esterna sull'ordine o sul lead", [false, false], [/\bUNIQUE\b/i.test(sql), /\bREFERENCES\b/i.test(sql)]);
  c("indice parziale su lead_id e indice su status", [true, true], [
    /CREATE INDEX IF NOT EXISTS \w+ ON public\.shop_orders \(lead_id\) WHERE lead_id IS NOT NULL/.test(tutto),
    /CREATE INDEX IF NOT EXISTS \w+ ON public\.shop_orders \(status\)/.test(tutto),
  ]);

  /* ── il registro degli eventi: protezione accesa, NESSUNA policy ── */
  const corpoEventi = stmt.find((s) => s.startsWith("CREATE TABLE IF NOT EXISTS public.shop_order_eventi")) ?? "";
  c("shop_order_eventi: le colonne del piano, nell'ordine", COLONNE_EVENTI,
    (sql.match(/CREATE TABLE IF NOT EXISTS public\.shop_order_eventi \(([\s\S]*?)\n\);/) ?? [, ""])[1].split("\n").map((r) => r.trim().split(/\s+/)[0]).filter(Boolean));
  c("shop_order_eventi: order_id senza chiave esterna, tipo non nullo", [false, true], [/order_id[^,]*REFERENCES/i.test(corpoEventi), /\btipo TEXT NOT NULL/.test(corpoEventi)]);
  c("shop_order_eventi: ENABLE ROW LEVEL SECURITY e nessuna policy su di essa", [true, 0], [
    /ALTER TABLE public\.shop_order_eventi ENABLE ROW LEVEL SECURITY/.test(tutto),
    [...tutto.matchAll(/(CREATE|DROP|ALTER) POLICY[^;]*shop_order_eventi/g)].length,
  ]);
  c("tutte le CREATE POLICY di M1 sono su shop_orders", true, [...tutto.matchAll(/CREATE POLICY "[^"]+" ON ([\w.]+)/g)].every((m) => m[1] === "public.shop_orders"));

  /* ── la policy stretta ── */
  const policy = stmt.find((s) => s.startsWith(`CREATE POLICY "${POLICY_NUOVA}"`)) ?? "";
  c("la policy stretta c'è, una sola, FOR INSERT", [1, true], [(tutto.match(/CREATE POLICY/g) ?? []).length, /FOR INSERT WITH CHECK/.test(policy)]);
  c("la policy stretta chiede status = 'nuovo'", true, /status = 'nuovo'/.test(policy));
  for (const [nome] of Object.entries(COLONNE)) {
    const ok = nome === "senza_lead" ? /COALESCE\(senza_lead, false\) = false/.test(policy) : new RegExp(`\\b${nome} IS NULL`).test(policy);
    c(`la policy stretta nomina ${nome} (vuoto da fuori)`, true, ok);
  }
  c("la policy stretta ha la finestra su created_at (10 minuti indietro, 1 avanti)", [true, true], [
    /created_at > now\(\) - interval '10 minutes'/.test(policy),
    /created_at <= now\(\) \+ interval '1 minute'/.test(policy),
  ]);
  c("la policy stretta non ha OR (ogni condizione in AND) e non ha true/auth.role", [false, false], [/\bOR\b/i.test(policy), /WITH CHECK \(\s*true|auth\.role/i.test(policy)]);
  const iNuova = tutto.indexOf(`CREATE POLICY "${POLICY_NUOVA}"`);
  const iVecchia = tutto.indexOf(`DROP POLICY IF EXISTS "${POLICY_VECCHIA}"`);
  c("la policy stretta viene CREATA prima che la vecchia sia tolta", true, iNuova > 0 && iVecchia > iNuova);
  const iBegin = tutto.indexOf("BEGIN"), iCommit = tutto.indexOf("COMMIT");
  c("le due policy stanno dentro un solo BEGIN … COMMIT, e NOTIFY dopo il COMMIT", [true, 1, 1, true], [
    iBegin > 0 && iBegin < iNuova && iVecchia < iCommit,
    (tutto.match(/\bBEGIN\b/g) ?? []).length,
    (tutto.match(/\bCOMMIT\b/g) ?? []).length,
    tutto.indexOf("NOTIFY pgrst") > iCommit,
  ]);
  c("le policy authenticated di lettura/aggiornamento NON si toccano in M1", false, /authenticated can (read|update) shop orders/.test(tutto));
  c("NOTIFY pgrst per ricaricare lo schema", true, /NOTIFY pgrst, 'reload schema'/.test(tutto));

  /* ── cosa scrive il checkout: tutto accettato dalla policy stretta ── */
  const invio = readFileSync(join(radice, "src/shop/invio-ordine.ts"), "utf8");
  const checkout = readFileSync(join(radice, "src/routes/shop.checkout.tsx"), "utf8");
  const originale = senzaCommenti(readFileSync(join(cartella, ORIGINALE), "utf8"));
  const corpoRiga = (invio.match(/export function rigaOrdine[\s\S]*?return \{([\s\S]*?)\n  \};/) ?? [])[1] ?? "";
  const campiCheckout = [...corpoRiga.matchAll(/^\s*(\w+)\s*[:,]/gm)].map((m) => m[1]).sort();
  const tabellaOriginale = (originale.match(/CREATE TABLE IF NOT EXISTS public\.shop_orders \(([\s\S]*?)\n\);/) ?? [])[1] ?? "";
  const colonneOriginali = tabellaOriginale.split("\n").map((r) => r.trim()).filter(Boolean).map((r) => ({
    nome: r.split(/\s+/)[0],
    obbligatoria: /NOT NULL/.test(r) && !/DEFAULT/.test(r) && !/PRIMARY KEY/.test(r),
  }));
  c("il checkout manda dei campi (la lettura del sorgente funziona)", true, campiCheckout.length >= 14);
  c("ogni campo del checkout è una colonna di shop_orders che esiste già", [], campiCheckout.filter((k) => !colonneOriginali.some((o) => o.nome === k)));
  c("nessun campo del checkout è tra quelli che la policy vuole vuoti", [], campiCheckout.filter((k) => k in COLONNE));
  c("il checkout non manda created_at (vale now(): rientra nella finestra), né nella riga né nella pagina", [false, false], [campiCheckout.includes("created_at"), /created_at/.test(checkout)]);
  c("il checkout manda tutte le colonne obbligatorie senza default", [], colonneOriginali.filter((o) => o.obbligatoria && !campiCheckout.includes(o.nome)).map((o) => o.nome));
  c("lo stato che manda il checkout è quello che la policy accetta", true, /status: "nuovo"/.test(corpoRiga) && /status = 'nuovo'/.test(policy));
  c("il checkout inserisce in shop_orders con insert() semplice (nessun upsert/update: la policy è solo INSERT)", [true, false], [/from\("shop_orders"\)\.insert\(/.test(checkout), /\.(upsert|update)\(/.test(checkout)]);

  /* ── M2: solo le due policy dei «loggati», fuori da migrations/ ── */
  const m2 = readFileSync(pM2, "utf8");
  const sql2 = senzaCommenti(m2);
  c("M2: solo BEGIN, due DROP POLICY IF EXISTS dei nomi attesi, COMMIT, NOTIFY", [
    "BEGIN",
    'DROP POLICY IF EXISTS "authenticated can read shop orders" ON public.shop_orders',
    'DROP POLICY IF EXISTS "authenticated can update shop orders" ON public.shop_orders',
    "COMMIT",
    "NOTIFY pgrst, 'reload schema'",
  ], istruzioni(m2));
  c("M2: nessun altro verbo pericoloso (TRUNCATE, DELETE, UPDATE, DROP TABLE/COLUMN, CREATE)", false, /\b(TRUNCATE|DELETE|UPDATE|CREATE|ALTER)\b|DROP\s+(TABLE|COLUMN)/i.test(sql2.replace(/"[^"]*"/g, '""')));
  c("M2: spiega quando (dopo il collaudo di R2), un posto per la data, il perché e la query di controllo", [true, true, true, true], [
    /QUANDO/.test(m2) && /collaudo/i.test(m2),
    /Decisione del titolare: data/.test(m2),
    /PERCH/.test(m2) && /account Supabase/.test(m2),
    /from pg_policies/i.test(m2),
  ]);
  c("M2: il ripristino (commentato) rimette entrambe le policy di prima", [true, true, true], [
    /--\s*CREATE POLICY "authenticated can read shop orders"[\s\S]*?USING \(auth\.role\(\) = 'authenticated'\)/.test(m2),
    /--\s*CREATE POLICY "authenticated can update shop orders"[\s\S]*?USING \(auth\.role\(\) = 'authenticated'\)/.test(m2),
    /COME SI ANNULLA/.test(m2),
  ]);
  c("nessun file in supabase/migrations/ nomina M2 e il suo nome non è «.sql» dentro migrations/", false,
    readdirSync(cartella).some((f) => f.includes("SOLO-SERVER") || f.includes("ORDINI-SOLO")));

  /* ── l'intestazione di M1: per il titolare ── */
  const testa = grezzo.slice(0, grezzo.search(/^ALTER TABLE|^CREATE /m)).replace(/^-- ?/gm, "");
  c("M1 in testa (commento): la query su pg_policies letta PRIMA, per shop_orders", [true, true], [
    /select policyname, cmd, roles, qual, with_check\s+from pg_policies\s+where schemaname = 'public' and tablename = 'shop_orders'/i.test(testa),
    /PRIMA DI LANCIARLA/.test(testa),
  ]);
  c("M1 in testa: chi la lancia (il titolare), rilanciabile, come si annulla", [true, true, true], [/TITOLARE/.test(testa), /DUE VOLTE NON FA DANNI/.test(testa), /COME SI ANNULLA/.test(testa)]);
  c("M1 in coda (commento): il ripristino della policy larga, con la nuova tolta dopo, in transazione", true,
    /--\s*DROP POLICY IF EXISTS "anyone can insert shop order"[\s\S]*?--\s*CREATE POLICY "anyone can insert shop order"[\s\S]*?--\s*WITH CHECK \(true\);[\s\S]*?--\s*DROP POLICY IF EXISTS "shop_orders_insert_checkout"[\s\S]*?--\s*COMMIT;/.test(
      grezzo.slice(grezzo.indexOf("NOTIFY pgrst")),
    ));
  c("il nome di M1 viene dopo l'ultima migrazione già esistente", true, M1 > readdirSync(cartella).filter((f) => f.endsWith(".sql") && f !== M1).sort().at(-1));
  c("le parentesi di M1 e M2 tornano", [0, 0], [sql, sql2].map((t) => [...t].reduce((n, ch) => n + (ch === "(" ? 1 : ch === ")" ? -1 : 0), 0)));

  /* ── i tipi a mano (types.ts) ── */
  const tipi = readFileSync(join(radice, "src/integrations/supabase/types.ts"), "utf8");
  const blocco = (nome) => (tipi.match(new RegExp(`\\n      ${nome}: \\{[\\s\\S]*?\\n        Relationships: \\[\\]\\n      \\}`)) ?? [""])[0];
  const sezioni = (b) => ({ Row: (b.match(/Row: \{([\s\S]*?)\n        \}/) ?? [])[1] ?? "", Insert: (b.match(/Insert: \{([\s\S]*?)\n        \}/) ?? [])[1] ?? "", Update: (b.match(/Update: \{([\s\S]*?)\n        \}/) ?? [])[1] ?? "" });
  const chiavi = (s) => [...s.matchAll(/^\s+(\w+)\??:/gm)].map((m) => m[1]);
  const so = sezioni(blocco("shop_orders"));
  for (const k of Object.keys(COLONNE)) {
    c(`types.ts · shop_orders · ${k} in Row, Insert (facoltativa) e Update`, [true, true, true], [new RegExp(`^\\s+${k}: `, "m").test(so.Row), new RegExp(`^\\s+${k}\\?: `, "m").test(so.Insert), new RegExp(`^\\s+${k}\\?: `, "m").test(so.Update)]);
  }
  c("types.ts · shop_orders: le colonne di prima ci sono ancora (Row)", [], ["id", "created_at", "order_ref", "nome", "cognome", "email", "telefono", "indirizzo", "citta", "cap", "note", "items", "subtotal", "shipping", "total", "status"].filter((k) => !chiavi(so.Row).includes(k)));
  c("types.ts · shop_orders: tipi nuovi (UUID e date nullable, importo numero, senza_lead booleano)", [true, true, true, true], [
    /lead_id: string \| null/.test(so.Row), /pagato_il: string \| null/.test(so.Row), /pagato_importo: number \| null/.test(so.Row), /senza_lead: boolean \| null/.test(so.Row),
  ]);
  const ev = sezioni(blocco("shop_order_eventi"));
  c("types.ts · shop_order_eventi: le colonne del piano in Row, Insert e Update", [COLONNE_EVENTI, COLONNE_EVENTI, COLONNE_EVENTI], [chiavi(ev.Row), chiavi(ev.Insert), chiavi(ev.Update)].map((l) => [...l].sort((a, b) => COLONNE_EVENTI.indexOf(a) - COLONNE_EVENTI.indexOf(b))));
  c("types.ts · shop_order_eventi: obbligatori solo order_id e tipo in Insert", ["order_id", "tipo"], [...ev.Insert.matchAll(/^\s+(\w+): /gm)].map((m) => m[1]));
  c("types.ts · shop_order_eventi sta tra le tabelle, prima di shop_orders (ordine alfabetico)", true, tipi.indexOf("      shop_order_eventi: {") < tipi.indexOf("      shop_orders: {") && tipi.indexOf("      shop_order_eventi: {") > 0);

  /* ── lo script su Postgres vero esiste e si protegge ── */
  const pSql = join(radice, "prove/sql/ecommerce-ordini.sql");
  const script = existsSync(pSql) ? readFileSync(pSql, "utf8") : "";
  c("prove/sql/ecommerce-ordini.sql esiste, applica M1 due volte e M2, e rifiuta di girare fuori da un database «prova»", [true, true, true, true], [
    script.length > 0, (script.match(/\\i :m1/g) ?? []).length >= 2, /\\i :m2/.test(script), /current_database\(\)[^;]*prova/i.test(script),
  ]);
}
