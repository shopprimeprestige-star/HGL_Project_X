/** ── SHOP R2 · T41b · S4b: IL TRIGGER DI PROTEZIONE DI shop_orders, TESTO SQL (21/11/2026) ──────────────────────
 *  Qui NON gira un Postgres: si legge il testo di `20261122123000_shop_orders_protezione.sql` (COMMENTI TOLTI prima).
 *  Il comportamento vero sta in `prove/sql/shop-orders-protezione.sql` (Postgres usa-e-getta, ruolo e `request.jwt.claims` come PostgREST).
 *  Cosa deve valere (PIANO-R2 §4 «S4b», D43, T41b):
 *   · un solo `CREATE … TRIGGER` (`shop_orders_protezione`, BEFORE INSERT OR UPDATE, per riga) e una sola funzione, SECURITY DEFINER
 *     con search_path = public, chiusa ad anon e authenticated; nessuna policy creata, tolta o cambiata;
 *   · controllo iniziale di S4 PRIMA di qualunque scrittura;
 *   · nessun DELETE, DROP o TRUNCATE nel testo eseguito: il `DROP TRIGGER IF EXISTS` del ripristino sta SOLO in un commento;
 *   · il corpo non nomina colonne a mano salvo: `note_interne` e `aggiornato_il` (lista bianca dell'UPDATE), la lista dell'INSERT
 *     (UGUALE alle chiavi di `rigaOrdine` in `src/shop/invio-ordine.ts` più `created_at`: se il checkout aggiunge un campo e la lista no, qui è rosso)
 *     e la tabella dei valori di partenza dell'INSERT (colonne di M1/S4, mai `pagato_il`);
 *   · il corpo non nomina `pagato_il` (non si rompe se M1 non c'è);
 *   · solo `anon` e `authenticated` sono controllati; l'interruttore si legge senza far fallire l'insert (fallisce aperto), le colonne falliscono chiuse;
 *   · nessun dato toccato: nessun UPDATE, INSERT o ALTER TABLE fuori dal corpo. */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { COLONNE_S4 } from "./_finto-db.mjs";

const FILE = "20261122123000_shop_orders_protezione.sql";
const senzaCommenti = (sql) => sql.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--[^\n]*/g, "").replace(/[ \t]+\n/g, "\n");
const piatto = (s) => s.replace(/\s+/g, " ").trim();

export async function prove(_mod, { c, gruppo, radice }) {
  gruppo("SHOP R2 · T41b · S4b TRIGGER DI PROTEZIONE: TESTO SQL (21/11/2026)");
  const percorso = join(radice, "supabase/migrations", FILE);
  const migrazioni = join(radice, "supabase/migrations");
  c("S4b esiste col nome del piano e viene subito dopo S4 e prima di S5", [true, true, true], [
    existsSync(percorso), FILE > "20261122120000_shop_pagamenti.sql" && existsSync(join(migrazioni, "20261122120000_shop_pagamenti.sql")), FILE < "20261122130000_shop_spedizioni.sql",
  ]);
  if (!existsSync(percorso)) return;
  const grezzo = readFileSync(percorso, "utf8");
  const sql = senzaCommenti(grezzo);
  const p = piatto(sql);

  // ── fuori e dentro il corpo ──
  const m = /CREATE OR REPLACE FUNCTION public\.shop_orders_protezione\(\) RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS \$\$([\s\S]*?)\$\$/.exec(sql);
  const corpo = m?.[1] ?? "";
  const fuori = sql.replace(/\$\$[\s\S]*?\$\$/g, "$$…$$").replace(/BEFORE INSERT OR UPDATE ON/, "BEFORE … ON"); // fuori dai corpi e senza le parole dell'evento del trigger
  c("una sola funzione, un trigger di tipo trigger, SECURITY DEFINER con search_path = public (il testo ha esattamente quella forma)", [true, 1, 1], [
    Boolean(m), (sql.match(/^CREATE OR REPLACE FUNCTION/gm) ?? []).length, (sql.match(/^CREATE (OR REPLACE )?TRIGGER/gm) ?? []).length,
  ]);
  c("il trigger: shop_orders_protezione, BEFORE INSERT OR UPDATE su public.shop_orders, per riga, con quella funzione (sostituisce se stesso: CREATE OR REPLACE)", true,
    /CREATE OR REPLACE TRIGGER shop_orders_protezione BEFORE INSERT OR UPDATE ON public\.shop_orders FOR EACH ROW EXECUTE FUNCTION public\.shop_orders_protezione\(\);/.test(p));
  c("la funzione è chiusa: REVOKE ALL … FROM PUBLIC, anon, authenticated; nessun GRANT di niente", [true, false], [
    /REVOKE ALL ON FUNCTION public\.shop_orders_protezione\(\) FROM PUBLIC, anon, authenticated;/.test(p), /\bGRANT\b/i.test(sql),
  ]);
  c("nessuna policy creata, tolta o cambiata; nessun ALTER, nessun UPDATE/INSERT fuori dal corpo (nessun dato toccato)", [false, false, false, false], [
    /\b(CREATE|DROP|ALTER) POLICY\b/i.test(sql), /\bALTER TABLE\b/i.test(sql), /\bUPDATE\b/.test(fuori), /\bINSERT\b/.test(fuori),
  ]);
  c("nessun DELETE, DROP o TRUNCATE nel testo eseguito (corpo compreso)", false, /\b(DELETE|DROP|TRUNCATE)\b/i.test(sql));
  c("il DROP TRIGGER IF EXISTS del ripristino sta SOLO in un commento (e il ripristino c'è, per il titolare)", [true, false], [
    /--\s*DROP TRIGGER IF EXISTS shop_orders_protezione ON public\.shop_orders;/.test(grezzo), /DROP TRIGGER/i.test(sql),
  ]);
  c("transazione unica (BEGIN … COMMIT) e nessun NOTIFY o seme: S4b è solo il trigger", [true, false], [/^BEGIN;/m.test(sql) && /^COMMIT;/m.test(sql), /NOTIFY|shop_impostazioni \(/.test(sql.replace(/\$\$[\s\S]*?\$\$/g, ""))]);

  // ── il controllo iniziale ──
  const doBlocco = /DO \$\$([\s\S]*?)\$\$;/.exec(sql);
  const primoCambio = sql.search(/CREATE (OR REPLACE )?(FUNCTION|TRIGGER)|REVOKE/);
  c("il controllo iniziale è un blocco DO PRIMA di qualunque CREATE o REVOKE; si ferma se manca S4 (la tabella dei riservati o stato_pagamento) e nomina il file di S4", [true, true, true], [
    Boolean(doBlocco) && doBlocco.index < primoCambio, /shop_ordini_riservati/.test(doBlocco?.[1] ?? "") && /stato_pagamento/.test(doBlocco?.[1] ?? ""), /20261122120000_shop_pagamenti\.sql/.test(doBlocco?.[1] ?? "") && /RAISE EXCEPTION 'S4b si ferma/.test(doBlocco?.[1] ?? ""),
  ]);

  // ── le colonne nominate nel corpo ──
  const quasi = /v_ammesse\s+text\[\]\s*:=\s*ARRAY\[([^\]]*)\]/.exec(corpo)?.[1] ?? "";
  const ammesse = [...quasi.matchAll(/'([a-z_]+)'/g)].map((x) => x[1]);
  const partenzaTesto = /v_partenza\s+jsonb\s*:=\s*'([^']*)'::jsonb/.exec(corpo)?.[1] ?? "{}";
  let partenza = {};
  try { partenza = JSON.parse(partenzaTesto); } catch { /* resta vuoto: la prova sotto diventa rossa */ }
  // le chiavi di rigaOrdine, lette dal sorgente del checkout
  const invio = readFileSync(join(radice, "src/shop/invio-ordine.ts"), "utf8");
  const riga = /export function rigaOrdine\([^)]*\)\s*\{[\s\S]*?return \{([\s\S]*?)\n  \};/.exec(invio)?.[1] ?? "";
  const chiaviRiga = [...riga.matchAll(/^\s{4}([a-z_]+):/gm)].map((x) => x[1]);
  c("la lista dell'INSERT = le chiavi di rigaOrdine (src/shop/invio-ordine.ts) più created_at: un campo nuovo del checkout non resta fuori in silenzio", [[], [], true], [
    chiaviRiga.filter((k) => !ammesse.includes(k)), ammesse.filter((k) => !chiaviRiga.includes(k) && k !== "created_at"), chiaviRiga.length >= 15 && ammesse.includes("created_at"),
  ]);
  c("la tabella dei valori di partenza nomina solo colonne di shop_orders di M1 o S4 (nessun refuso) e nessuna che sta già nella lista ammessa", [[], []], [
    Object.keys(partenza).filter((k) => !(k in COLONNE_S4) && k !== "senza_lead"), Object.keys(partenza).filter((k) => ammesse.includes(k)),
  ]);
  c("i valori di partenza sono quelli dei default di S4 (e di M1: senza_lead falso) per ogni colonna che hanno in comune", [], Object.entries(partenza).filter(([k, v]) => k in COLONNE_S4 && JSON.stringify(COLONNE_S4[k]) !== JSON.stringify(v)).map(([k]) => k));
  // ogni stringa «da nome di colonna» fra apici nel corpo deve essere una di quelle ammesse
  const consentiti = new Set([...ammesse, ...Object.keys(partenza), "note_interne", "aggiornato_il", "anon", "authenticated", "role", "cassa_sito", "stripe", "INSERT", "null", "insufficient_privilege"]);
  const nominate = [...corpo.replace(/RAISE EXCEPTION '[^']*'/g, "").replace(/--[^\n]*/g, "").matchAll(/'([a-z_]+)'/g)].map((x) => x[1]).filter((x) => !consentiti.has(x));
  c("il corpo non nomina nessun'altra colonna o valore fra apici: solo lista ammessa, valori di partenza, note_interne e aggiornato_il (più i ruoli e l'interruttore)", [], [...new Set(nominate)]);
  c("il corpo non nomina pagato_il (né nessuna colonna di M1 o di S4 fuori dalla tabella dei valori di partenza)", [], ["pagato_il", "pagato_importo", "metodo_pagamento", "tracking", "lead_id", "stato_pagamento", "canale", "totale_cent", "scade_il", "stripe_sessione_id"].filter((k) => new RegExp(`\\b${k}\\b`).test(corpo)));
  c("la lista bianca dell'UPDATE: solo note_interne e aggiornato_il si tolgono dal confronto (to_jsonb(NEW) contro to_jsonb(OLD), chiave per chiave)", [true, 2, true], [
    /to_jsonb\(NEW\) - 'note_interne' - 'aggiornato_il'/.test(corpo) && /to_jsonb\(OLD\) - 'note_interne' - 'aggiornato_il'/.test(corpo), (corpo.match(/ - '/g) ?? []).length / 2,
    /v_nuovo -> v_chiave IS DISTINCT FROM v_vecchio -> v_chiave/.test(corpo),
  ]);

  // ── chi è controllato, che cosa si rifiuta, come ──
  c("controlla solo chi è «anon» o «authenticated» (auth.role() e, se il token manca, il ruolo della sessione): gli altri tornano NEW senza guardare", [true, true], [
    /v_ruolo\s+text\s*:=\s*auth\.role\(\)/.test(corpo), /IF NOT \(COALESCE\(v_ruolo, ''\) IN \('anon', 'authenticated'\) OR COALESCE\(current_setting\('role', true\), ''\) IN \('anon', 'authenticated'\)\) THEN\s+RETURN NEW;/.test(corpo),
  ]);
  const lettura = /BEGIN\s+SELECT valore #>> '\{\}' INTO v_cassa FROM public\.shop_impostazioni WHERE chiave = 'cassa_sito';\s+EXCEPTION WHEN OTHERS THEN\s+v_cassa := NULL;\s+END;/.test(corpo);
  c("l'interruttore cassa_sito si legge in un sotto-blocco che fallisce APERTO (errore → NULL → l'insert passa); si blocca SOLO con «stripe»", [true, true], [lettura, /IF v_cassa = 'stripe' THEN\s+RAISE EXCEPTION 'ordine_non_ammesso/.test(corpo)]);
  c("le regole sulle colonne falliscono CHIUSE: un valore diverso dal suo valore di partenza è un errore 42501 (insufficient_privilege) che nomina la colonna", [true, 2], [
    /IS DISTINCT FROM COALESCE\(v_partenza -> v_chiave, 'null'::jsonb\) THEN\s+RAISE EXCEPTION 'colonna_protetta/.test(corpo), (corpo.match(/USING ERRCODE = 'insufficient_privilege'/g) ?? []).length - 1,
  ]);
  c("gli errori usano l'ERRCODE insufficient_privilege (42501) in tutti e tre i punti, e il testo di ogni errore comincia col suo nome (colonna_protetta, ordine_non_ammesso)", [3, true], [
    (corpo.match(/USING ERRCODE = 'insufficient_privilege'/g) ?? []).length, [...corpo.matchAll(/RAISE EXCEPTION '([a-z_]+):/g)].every((x) => ["colonna_protetta", "ordine_non_ammesso"].includes(x[1])),
  ]);
  c("un solo trigger (INSERT e UPDATE nella stessa funzione) e nessun trigger su altre tabelle; nessun DELETE tra gli eventi", [true, false], [/BEFORE INSERT OR UPDATE ON public\.shop_orders/.test(p), /BEFORE (INSERT OR UPDATE OR DELETE|DELETE)/.test(p)]);
}
