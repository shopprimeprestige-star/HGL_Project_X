/** ── PROVA C2 · LA MIGRAZIONE DEL SITO (controllo statico) ─────────────────
 *  Nessun database: la migrazione si legge come testo. La applica il titolare
 *  dal SQL Editor, mai noi. Qui si controlla che sia fatta come da piano:
 *  solo aggiunte, funzioni strette, orari uguali a quelli del calendario.
 *  ───────────────────────────────────────────────────────────────────────── */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";
import { leggi, nuovaProva, radice } from "./_comune.mjs";

const { c, vero, finisci } = nuovaProva("migrazione del sito");
const NOME = "20261014200000_sito_lead_provenienza.sql";
const REL = `supabase/migrations/${NOME}`;

if (!existsSync(join(radice, REL))) {
  console.error(`  ✗ manca ${REL}`);
  process.exit(1);
}
const sql = leggi(REL);
//  Senza commenti: le parole vietate nel codice si cercano qui, i commenti si leggono a parte.
const codice = sql.replace(/--[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");

/* ── Posizione e testa del file ────────────────────────────────────────── */
vero("il nome ordina dopo le migrazioni del cantiere WhatsApp (…120100)", NOME > "20261014120100");
const testa = sql.split("\n").slice(0, 30).join("\n");
vero("in testa: si applica dal SQL Editor", /SQL Editor/i.test(testa));
vero("in testa: prima di pubblicare", /prima di pubblicare/i.test(testa));
vero("in testa: si può rieseguire", /rieseguibil/i.test(testa));
vero("in testa: funziona anche senza (rete di sicurezza)", /anche senza/i.test(testa));

/* ── 1. Le 7 colonne ───────────────────────────────────────────────────── */
for (const col of [
  "origine",
  "punto_ingresso",
  "problema_principale",
  "problema_altro",
  "fascia_oraria",
  "prodotto_stock",
  "chiave_orario_hash",
]) {
  vero(`colonna ${col}: ADD COLUMN IF NOT EXISTS … text`, new RegExp(`ADD COLUMN IF NOT EXISTS\\s+${col}\\s+text\\s*(,|;)`, "i").test(codice));
}
vero("le colonne sono su public.public_leads", /ALTER TABLE\s+public\.public_leads/i.test(codice));
vero("nessuna colonna ha un valore predefinito (le righe vecchie restano vuote)", !/ADD COLUMN[^;]*\bDEFAULT\b/i.test(codice));
vero("nessun NOT NULL (tranne IS NOT NULL nei filtri)", !/(?<!IS )NOT NULL/i.test(codice));

/* ── 2. Controlli, aggiunti solo se mancano ────────────────────────────── */
vero("controlli dentro DO $$ con pg_constraint", /DO \$\$[\s\S]*pg_constraint[\s\S]*\$\$/i.test(codice));
vero("controllo origine", /origine IS NULL OR origine IN \('stock',\s*'consulenza'\)/i.test(codice));
vero("controllo fascia", /fascia_oraria IS NULL OR fascia_oraria IN \('mattina',\s*'pomeriggio',\s*'sera'\)/i.test(codice));
vero("controllo lunghezza problema_altro <= 120", /char_length\(problema_altro\)\s*<=\s*120/i.test(codice));
vero("controllo lunghezza prodotto_stock <= 120", /char_length\(prodotto_stock\)\s*<=\s*120/i.test(codice));
vero("ogni controllo è protetto da IF NOT EXISTS", (codice.match(/IF NOT EXISTS\s*\(\s*SELECT[^)]*pg_constraint/gi) ?? []).length >= 4);

/* ── 3. Indice ─────────────────────────────────────────────────────────── */
vero(
  "indice su origine, solo righe valorizzate",
  /CREATE INDEX IF NOT EXISTS idx_public_leads_origine\s+ON public\.public_leads\s*\(origine\)\s*WHERE origine IS NOT NULL;/i.test(codice),
);

/* ── 4. fissa_orario_lead_sito ─────────────────────────────────────────── */
const f1 = codice.match(/CREATE OR REPLACE FUNCTION public\.fissa_orario_lead_sito\(([\s\S]*?)\$[a-z_]*\$;?/i);
vero("c'è la funzione fissa_orario_lead_sito", !!f1);
const testoF1 = codice.slice(codice.search(/CREATE OR REPLACE FUNCTION public\.fissa_orario_lead_sito/i), codice.search(/CREATE OR REPLACE FUNCTION public\.orari_occupati_sito/i));
vero(
  "firma: (p_id uuid, p_chiave text, p_data date, p_ora text) RETURNS text",
  /fissa_orario_lead_sito\(\s*p_id uuid,\s*p_chiave text,\s*p_data date,\s*p_ora text\s*\)\s*RETURNS text/i.test(testoF1),
);
vero("LANGUAGE plpgsql SECURITY DEFINER", /LANGUAGE plpgsql[\s\S]{0,40}SECURITY DEFINER/i.test(testoF1));
vero("search_path fisso", /SET search_path = public, pg_temp/i.test(testoF1));

//  (a) lead giusto
vero("(a) chiave lunga almeno 32", /char_length\(p_chiave\)\s*<\s*32/i.test(testoF1));
vero("(a) impronta SHA-256 senza estensioni", /encode\(sha256\(convert_to\(p_chiave,\s*'UTF8'\)\),\s*'hex'\)/i.test(testoF1));
vero("(a) confronta con chiave_orario_hash", /chiave_orario_hash/.test(testoF1));
vero("(a) lead senza orario", /data_slot IS NULL/i.test(testoF1) && /ora_slot IS NULL/i.test(testoF1));
vero("(a) nato da meno di 2 ore", /created_at\s*>\s*now\(\)\s*-\s*interval '2 hours'/i.test(testoF1));
vero("(a) non preso in carico: assigned_to_user_id IS NULL", /assigned_to_user_id IS NULL/i.test(testoF1));
vero("(a) non preso in carico: status = 'nuovo'", /status\s*=\s*'nuovo'/i.test(testoF1));
vero("MAI accepted_at (la finestra «accetta» lo scrive subito)", !/accepted_at/i.test(codice));

//  (b) orario valido
vero("(b) riga di funnel_settings ORDER BY created_at ASC LIMIT 1", /FROM public\.funnel_settings\s+ORDER BY created_at ASC\s+LIMIT 1/i.test(testoF1));
vero("(b) riga assente OPPURE time_slots vuoto → orari predefiniti", /cardinality\([a-z_.]*time_slots\)\s*=\s*0/i.test(testoF1) && /NOT FOUND|IS NULL/i.test(testoF1));
vero("(b) p_ora nel formato HH:MM", /\^\[0-2\]\[0-9\]:\[0-5\]\[0-9\]\$/.test(testoF1));
vero("(b) oggi e ora di Roma", /Europe\/Rome/.test(testoF1));
vero("(b) giorno della settimana con DOW (0 = domenica)", /EXTRACT\(DOW FROM p_data\)/i.test(testoF1));
vero("(b) MAI ISODOW", !/ISODOW/i.test(codice));
vero("(b) blocked_weekdays", /blocked_weekdays/.test(testoF1));
vero("(b) blocked_dates con = ANY", /p_data\s*=\s*ANY\([a-z_.]*blocked_dates\)/i.test(testoF1));
vero(
  "(b) blocked_slots jsonb con operatore ? (non ->>)",
  /COALESCE\([a-z_.]*blocked_slots\s*->\s*to_char\(p_data,\s*'YYYY-MM-DD'\),\s*'\[\]'::jsonb\)\s*\?\s*p_ora/i.test(testoF1) && !/blocked_slots\s*->>/i.test(testoF1),
);

//  (c) libero, con lucchetto
vero("(c) lucchetto sul solo slot", /pg_advisory_xact_lock\(hashtext\('slot:'\s*\|\|\s*p_data\s*\|\|\s*' '\s*\|\|\s*p_ora\)\)/i.test(testoF1));
vero("(c) orario libero: slot_released = false e slot_pending = false", /slot_released\s*=\s*false/i.test(testoF1) && /slot_pending\s*=\s*false/i.test(testoF1));

//  Ordine delle condizioni: (a) → (b) → lucchetto → 'occupato'
const pos = (re) => testoF1.search(re);
vero(
  "ordine: lead giusto, poi orario valido, poi lucchetto, poi occupato",
  pos(/chiave_orario_hash/) < pos(/EXTRACT\(DOW/i) && pos(/EXTRACT\(DOW/i) < pos(/pg_advisory_xact_lock/i) && pos(/pg_advisory_xact_lock/i) < pos(/'occupato'/),
);
vero("risponde solo fissato · occupato · non_valido", ["'fissato'", "'occupato'", "'non_valido'"].every((r) => testoF1.includes(r)));
vero("nessun'altra risposta testuale (RETURN 'x')", (testoF1.match(/RETURN\s+'[a-z_]+'/gi) ?? []).every((r) => /fissato|occupato|non_valido/.test(r)));

//  Aggiorna solo data e ora
const aggiornamenti = testoF1.match(/UPDATE\s+public\.public_leads\s+SET([\s\S]*?)WHERE/gi) ?? [];
c("un solo UPDATE nella funzione", 1, aggiornamenti.length);
const set = (aggiornamenti[0] ?? "").replace(/UPDATE\s+public\.public_leads\s+SET/i, "").replace(/WHERE/i, "");
c("l'UPDATE tocca solo data_slot e ora_slot", ["data_slot", "ora_slot"], set.split(",").map((x) => x.split("=")[0].trim()).sort());

//  Gli orari predefiniti scritti nella funzione = quelli del calendario
{
  const require = createRequire(join(radice, "package.json"));
  const { transformSync } = require("esbuild");
  const sorgente = leggi("src/landing/booking/BookingFunnel.tsx");
  const m = sorgente.match(/function buildDefaultSlots\(\)[\s\S]*?\n}\n/);
  vero("trovo buildDefaultSlots in BookingFunnel.tsx", !!m);
  const js = transformSync(m ? m[0] : "", { loader: "ts" }).code;
  const calendario = new Function(`${js}; return buildDefaultSlots();`)();
  c("il calendario va dalle 09:00 alle 21:30 ogni 30 minuti (26 orari)", 26, calendario.length);
  const dichiarazione = testoF1.match(/ARRAY\[((?:\s*'\d\d:\d\d'\s*,?)+)\]/);
  vero("la funzione scrive l'elenco predefinito come ARRAY[…]", !!dichiarazione);
  const nellaFunzione = dichiarazione ? [...dichiarazione[1].matchAll(/'(\d\d:\d\d)'/g)].map((x) => x[1]) : [];
  c("elenco predefinito della funzione = buildDefaultSlots()", calendario, nellaFunzione);
}

/* ── 5. orari_occupati_sito ────────────────────────────────────────────── */
const testoF2 = codice.slice(codice.search(/CREATE OR REPLACE FUNCTION public\.orari_occupati_sito/i), codice.search(/REVOKE ALL ON FUNCTION/i));
vero(
  "firma: (p_da date) RETURNS TABLE(data_slot date, ora_slot text)",
  /orari_occupati_sito\(\s*p_da date\s*\)\s*RETURNS TABLE\(\s*data_slot date,\s*ora_slot text\s*\)/i.test(testoF2),
);
vero("LANGUAGE sql STABLE SECURITY DEFINER", /LANGUAGE sql[\s\S]{0,30}STABLE[\s\S]{0,30}SECURITY DEFINER/i.test(testoF2));
vero("search_path fisso", /SET search_path = public, pg_temp/i.test(testoF2));
vero("legge solo data e ora, mai altre colonne", /SELECT\s+(l\.)?data_slot,\s*(l\.)?ora_slot\s+FROM public\.public_leads/i.test(testoF2) && !/SELECT\s+\*/i.test(testoF2));
vero("da p_da in poi", /data_slot\s*>=\s*p_da/i.test(testoF2));
vero("non rilasciati e non in attesa", /slot_released\s*=\s*false/i.test(testoF2) && /slot_pending\s*=\s*false/i.test(testoF2));
vero("data e ora non nulle", /data_slot IS NOT NULL/i.test(testoF2) && /ora_slot IS NOT NULL/i.test(testoF2));

/* ── 6. Chi può chiamarle ──────────────────────────────────────────────── */
vero(
  "REVOKE ALL … FROM PUBLIC per tutte e due",
  /REVOKE ALL ON FUNCTION public\.fissa_orario_lead_sito\(uuid,\s*text,\s*date,\s*text\)\s+FROM PUBLIC;/i.test(codice) &&
    /REVOKE ALL ON FUNCTION public\.orari_occupati_sito\(date\)\s+FROM PUBLIC;/i.test(codice),
);
vero(
  "GRANT EXECUTE … TO anon, authenticated per tutte e due",
  /GRANT EXECUTE ON FUNCTION public\.fissa_orario_lead_sito\(uuid,\s*text,\s*date,\s*text\)\s+TO anon, authenticated;/i.test(codice) &&
    /GRANT EXECUTE ON FUNCTION public\.orari_occupati_sito\(date\)\s+TO anon, authenticated;/i.test(codice),
);
vero("REVOKE dopo le funzioni", codice.search(/REVOKE ALL/i) > codice.search(/CREATE OR REPLACE FUNCTION public\.orari_occupati_sito/i));

/* ── Vietato: solo aggiunte ────────────────────────────────────────────── */
for (const [nome, re] of [
  ["DROP", /\bDROP\b/i],
  ["DELETE", /\bDELETE\b/i],
  ["TRUNCATE", /\bTRUNCATE\b/i],
  ["POLICY (ALTER/DROP/CREATE)", /\b(ALTER|DROP|CREATE)\s+POLICY\b/i],
  ["ALTER TYPE", /\bALTER\s+TYPE\b/i],
  ["UNIQUE (nessun indice unico: i doppioni di oggi farebbero fallire la migrazione)", /\bUNIQUE\b/i],
  ["TRIGGER (nessun trigger: è del cantiere WhatsApp)", /\bCREATE\s+(OR REPLACE\s+)?TRIGGER\b/i],
  ["EXTENSION", /\bCREATE\s+EXTENSION\b/i],
  ["colonne consenso_whatsapp (sono della migrazione del cantiere WhatsApp)", /consenso_whatsapp/i],
]) {
  vero(`vietato: niente ${nome}`, !re.test(codice));
}
{
  //  Ogni UPDATE sta dentro la funzione, e non ce n'è altrove.
  const fuoriDaF1 = codice.replace(testoF1, "");
  vero("vietato: nessun UPDATE fuori da fissa_orario_lead_sito", !/\bUPDATE\b/i.test(fuoriDaF1));
}

/* ── Sicurezza e pulizia ───────────────────────────────────────────────── */
vero("nessuna chiave o JWT nel file", !/eyJ[A-Za-z0-9_-]{20,}/.test(sql) && !/service_role/i.test(sql));
vero("nessun numero di telefono o email", !/\b3\d{2}[ ]?\d{6,7}\b/.test(sql) && !/[\w.]+@[\w.]+\.\w{2,}/.test(sql));
for (const [parola, re] of [
  ["cura", /\bcura\b/i],
  ["ricrescita", /ricrescita/i],
  ["definitivo", /definitiv/i],
  ["garantito", /garantit/i],
  ["guarisce", /guaris/i],
  ["solo noi", /solo noi/i],
  ["Trustpilot", /trustpilot/i],
  ["Bio-Mimetic", /bio-mimetic/i],
  ["€", /€/],
]) {
  vero(`nessuna parola vietata: ${parola}`, !re.test(sql));
}

finisci();
