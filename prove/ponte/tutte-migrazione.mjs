/** ── PROVE: LA MIGRAZIONE «TUTTE LE CHAT» (testo SQL) ──
 *
 *  Commessa 2026-10-30-ponte-tutte-le-chat, Blocco 1 (T1/T3, PIANO §3). Come
 *  `migrazione.mjs`: qui NON gira un Postgres, si legge il testo di
 *  `20261030160000_ponte_tutte_le_chat.sql` (i commenti si TOLGONO prima: il
 *  «come si annulla» ha DROP scritti apposta e mai eseguiti). Il comportamento
 *  vero lo prova `prove/sql/ponte-tutte.sql` su un Postgres 16.
 *
 *  Il punto che il revisore ha chiesto (nota 2 del 30/10): `ponte_wa_scrivi` è
 *  ridefinita, e il suo corpo deve differire da quello di
 *  `20261029120000_ponte_whatsapp.sql` SOLO per le tre modifiche marcate
 *  («-- TUTTE LE CHAT:»). La prova costruisce il corpo atteso applicando alla
 *  v1 le sette sostituzioni delle tre modifiche e lo confronta riga per riga
 *  con la v2 (senza i commenti marcati): qualunque altra differenza la fa
 *  fallire.
 *  Dati inventati: nessun numero né nome vero.
 *
 *  `mod`: i moduli impacchettati da `prove/prove.mjs`. `aiuti`: `{ c, gruppo, radice }`. */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const FILE = "20261030160000_ponte_tutte_le_chat.sql";
const FILE_V1 = "20261029120000_ponte_whatsapp.sql";
/** Impronta (sha-256) della migrazione del ponte: questa commessa non la tocca. */
const IMPRONTA_V1 = "336116cbdd1aec163e0368fd59c5c74cb4ed364f1da2b6f7676fecf312a52df0";

const senzaCommenti = (sql) =>
  sql
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/--[^\n]*/g, "")
    .replace(/[ \t]+\n/g, "\n");

/** Il corpo di una funzione: dal suo CREATE al `END $$;` che la chiude. */
const corpoFunzione = (sql, nome) => {
  const da = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${nome}(`);
  if (da < 0) return "";
  const fine = sql.indexOf("$$;", da);
  return sql.slice(da, fine < 0 ? undefined : fine + 3);
};

/** Applica una sostituzione che deve trovare il testo UNA volta sola. */
function sostituisci(testo, prima, dopo, errori, nome) {
  const n = testo.split(prima).length - 1;
  if (n !== 1) errori.push(`${nome}: trovato ${n} volte`);
  return testo.replace(prima, () => dopo);
}

export async function provePonteTutteMigrazione(_mod, { c, gruppo, radice }) {
  gruppo("PONTE WHATSAPP · TUTTE LE CHAT · LA MIGRAZIONE (TESTO)");
  const cartella = join(radice, "supabase/migrations");
  const percorso = join(cartella, FILE);
  c("la migrazione esiste col nome del piano", true, existsSync(percorso));
  if (!existsSync(percorso)) return;

  const grezzo = readFileSync(percorso, "utf8");
  const sql = senzaCommenti(grezzo);
  const alto = sql.toUpperCase();
  const v1grezzo = readFileSync(join(cartella, FILE_V1), "utf8");

  /* ── solo aggiunte ────────────────────────────────────────────────────── */
  c("la migrazione del ponte (20261029120000) è IDENTICA: non si tocca", IMPRONTA_V1, createHash("sha256").update(v1grezzo).digest("hex"));
  c("niente DROP, DELETE, TRUNCATE fuori dai commenti", [false, false, false], [/\bDROP\b/.test(alto), /\bDELETE\b/.test(alto), /\bTRUNCATE\b/.test(alto)]);
  c("il «come si annulla» c'è, ma solo nel commento (DROP delle due funzioni, delle due colonne, dell'indice)", [true, false, 2, 2, 1], [
    /COME SI ANNULLA/i.test(grezzo),
    /\bDROP\b/i.test(sql),
    (grezzo.match(/DROP FUNCTION public\.ponte_wa_(promuovi|ritira)/g) ?? []).length,
    (grezzo.match(/DROP COLUMN (attesa_dal|promosso_il)/g) ?? []).length,
    (grezzo.match(/DROP INDEX public\.idx_wa_messages_da_promuovere/g) ?? []).length,
  ]);
  c("le colonne nuove: ADD COLUMN IF NOT EXISTS, nullable, nessun DEFAULT", [2, true], [
    (sql.match(/ADD COLUMN IF NOT EXISTS (attesa_dal|promosso_il) timestamptz;/g) ?? []).length,
    !/ADD COLUMN[^;]*(NOT NULL|DEFAULT)/i.test(sql),
  ]);
  c("l'indice è IF NOT EXISTS e PARZIALE", true,
    /CREATE INDEX IF NOT EXISTS idx_wa_messages_da_promuovere\s+ON public\.whatsapp_messages \(user_id, attesa_dal\)\s+WHERE attesa_dal IS NOT NULL AND promosso_il IS NULL AND duplicato_di IS NULL;/.test(sql));
  c("solo CREATE OR REPLACE delle tre funzioni (nessun CREATE FUNCTION secco)", [["ponte_wa_promuovi", "ponte_wa_ritira", "ponte_wa_scrivi"], 0],
    [[...sql.matchAll(/CREATE OR REPLACE FUNCTION public\.(\w+)/g)].map((x) => x[1]).sort(), (sql.match(/CREATE FUNCTION/g) ?? []).length]);
  c("nessuna tabella creata, nessuna policy", [0, 0], [(sql.match(/CREATE TABLE/g) ?? []).length, (sql.match(/CREATE POLICY/g) ?? []).length]);
  c("nessun indirizzo scritto a mano", false, /https?:\/\//i.test(grezzo));

  /* ── chi può chiamarle ───────────────────────────────────────────────── */
  const FIRME = { ponte_wa_scrivi: "uuid, jsonb, jsonb, jsonb", ponte_wa_ritira: "uuid, uuid", ponte_wa_promuovi: "uuid, int" };
  for (const [nome, firma] of Object.entries(FIRME)) {
    const corpo = corpoFunzione(sql, nome);
    c(`${nome}: SECURITY DEFINER con search_path = public, pg_temp`, true, /SECURITY DEFINER SET search_path = public, pg_temp/.test(corpo));
    c(`${nome}: REVOKE da PUBLIC, anon, authenticated e GRANT al solo service_role`, [true, true, false], [
      sql.includes(`REVOKE ALL ON FUNCTION public.${nome}(${firma}) FROM PUBLIC, anon, authenticated;`),
      sql.includes(`GRANT EXECUTE ON FUNCTION public.${nome}(${firma}) TO service_role;`),
      new RegExp(`GRANT[^;]*public\\.${nome}[^;]*(anon|authenticated|PUBLIC)`, "i").test(sql),
    ]);
  }
  c("NOTIFY pgrst per ricaricare lo schema", true, /NOTIFY pgrst, 'reload schema'\s*;/.test(sql));

  /* ── le due funzioni nuove scrivono SOLO le colonne dette ─────────────── */
  const setDi = (corpo, tab) =>
    [...corpo.matchAll(new RegExp(`UPDATE public\\.${tab}\\s+\\w*\\s*SET([\\s\\S]*?)\\b(?:WHERE)\\b`, "g"))]
      .flatMap((x) => [...x[1].matchAll(/(?:^|,)\s*(\w+)\s*=/g)].map((y) => y[1]));
  const promuovi = corpoFunzione(sql, "ponte_wa_promuovi");
  const ritira = corpoFunzione(sql, "ponte_wa_ritira");
  c("promuovi: sui contatti scrive solo non letti, anteprima, ultima entrata, last_message_at, updated_at",
    ["last_message_at", "ultimo_in_entrata_anteprima", "ultimo_in_entrata_il", "unread_count", "updated_at"], [...new Set(setDi(promuovi, "whatsapp_contacts"))].sort());
  c("promuovi: sui messaggi scrive solo attesa_dal (saltata) e promosso_il", ["attesa_dal", "promosso_il"], [...new Set(setDi(promuovi, "whatsapp_messages"))].sort());
  c("ritira: sui contatti scrive solo non letti e updated_at; sui messaggi solo promosso_il",
    [["unread_count", "updated_at"], ["promosso_il"]], [[...new Set(setDi(ritira, "whatsapp_contacts"))].sort(), [...new Set(setDi(ritira, "whatsapp_messages"))].sort()]);
  for (const [nome, corpo] of [["promuovi", promuovi], ["ritira", ritira]]) {
    c(`${nome}: mai scheda, id ManyChat, STOP, nome, risposto_il da scrivere; nessun INSERT, DELETE o altra tabella`, [], [
      ...["lead_id", "subscriber_id", "non_scrivere_dal", "display_name"].filter((k) => new RegExp(`\\b${k}\\s*=`).test(corpo)),
      ...(/\brisposto_il\s*=/.test(corpo) ? ["risposto_il"] : []),
      ...(/INSERT INTO|DELETE FROM/i.test(corpo) ? ["INSERT/DELETE"] : []),
      ...(/crm_leads|manychat_|whatsapp_settings|app_config/.test(corpo) ? ["altre tabelle"] : []),
    ]);
  }
  c("promuovi: FOR UPDATE … SKIP LOCKED, al più 500 righe, finestra di un giorno, p_attesa_s nullo vale 120", [true, true, true, true], [
    /FOR UPDATE OF w SKIP LOCKED/.test(promuovi),
    /LIMIT 500/.test(promuovi),
    /w\.attesa_dal >= now\(\) - interval '1 day'/.test(promuovi),
    /coalesce\(p_attesa_s, 120\)/.test(promuovi),
  ]);
  c("promuovi: solo righe in entrata del ponte, senza pari e non ancora promosse", true,
    ["w.canale = 'baileys'", "w.direction = 'inbound'", "w.duplicato_di IS NULL", "w.promosso_il IS NULL", "w.attesa_dal IS NOT NULL"].every((x) => promuovi.includes(x)));
  c("promuovi: se il titolare ha già risposto (risposto_il ≥ ora del messaggio) non si conta", true, /v_risp >= r\.created_at/.test(promuovi));
  c("ritira: solo se promossa e col pari di ManyChat; non letti mai sotto zero", [true, true, true], [
    /w\.promosso_il IS NOT NULL/.test(ritira) && /p\.canale = 'manychat'/.test(ritira),
    /greatest\(c\.unread_count - 1, 0\)/.test(ritira),
    /SET promosso_il = NULL/.test(ritira),
  ]);

  /* ── ponte_wa_scrivi v2 = v1 + le tre modifiche marcate, NIENT'ALTRO ──── */
  const v1 = corpoFunzione(v1grezzo, "ponte_wa_scrivi");
  const v2 = corpoFunzione(grezzo, "ponte_wa_scrivi");
  c("scrivi v1 e v2: stessa firma", true, v1.startsWith("CREATE OR REPLACE FUNCTION public.ponte_wa_scrivi(\n  p_user_id uuid,\n  p_righe jsonb,\n  p_pari jsonb,\n  p_nomi jsonb\n) RETURNS jsonb") &&
    v2.startsWith("CREATE OR REPLACE FUNCTION public.ponte_wa_scrivi(\n  p_user_id uuid,\n  p_righe jsonb,\n  p_pari jsonb,\n  p_nomi jsonb\n) RETURNS jsonb"));
  const marcate = v2.split("\n").filter((r) => /^\s*-- TUTTE LE CHAT:/.test(r));
  c("le righe marcate «-- TUTTE LE CHAT:» sono sei: (a) 1, (b) 2 (dichiarazione e ritiro), (c) 3 (nome in aggiornamento, in inserimento, in conflitto)", [6, true, true, true], [
    marcate.length,
    marcate.some((r) => r.includes("(a)")),
    marcate.some((r) => r.includes("(b)")),
    marcate.some((r) => r.includes("(c)")),
  ]);
  const v2pulita = v2.split("\n").filter((r) => !/^\s*-- TUTTE LE CHAT:/.test(r)).join("\n");

  const errori = [];
  let atteso = v1;
  //  (b) la riga del passo dei pari: dichiarazione, RETURNING, ritiro.
  atteso = sostituisci(atteso, "  v_id       uuid;\n", "  v_id       uuid;\n  v_riga     uuid;\n", errori, "b: dichiarazione");
  atteso = sostituisci(
    atteso,
    "           AND w.duplicato_di IS NULL;\n        GET DIAGNOSTICS v_n = ROW_COUNT;\n        v_doppioni := v_doppioni + v_n;\n",
    "           AND w.duplicato_di IS NULL\n        RETURNING w.id INTO v_riga;\n        GET DIAGNOSTICS v_n = ROW_COUNT;\n        v_doppioni := v_doppioni + v_n;\n" +
      "        IF v_riga IS NOT NULL THEN\n          PERFORM public.ponte_wa_ritira(p_user_id, v_riga);\n        END IF;\n",
    errori,
    "b: ritiro",
  );
  //  (a) attesa_dal nell'INSERT senza pari.
  atteso = sostituisci(atteso, "media_type, status, canale, created_at, raw_payload\n        ) VALUES (", "media_type, status, canale, created_at, raw_payload, attesa_dal\n        ) VALUES (", errori, "a: colonna");
  atteso = sostituisci(
    atteso,
    "          'baileys', to_timestamp(r.t), '{}'::jsonb\n        )\n        ON CONFLICT",
    "          'baileys', to_timestamp(r.t), '{}'::jsonb,\n          CASE WHEN r.e AND r.d = 'in' AND (v_mappa ->> r.k) IS NULL AND r.t >= v_adesso - 7 * 86400 THEN now() END\n        )\n        ON CONFLICT",
    errori,
    "a: valore",
  );
  //  (c) il nome del profilo non si salva per un contatto del ponte senza scheda.
  atteso = sostituisci(
    atteso,
    "               display_name    = coalesce(x.display_name, v_nome),\n",
    "               display_name    = CASE WHEN x.origine = 'baileys' AND x.lead_id IS NULL THEN x.display_name\n                                      ELSE coalesce(x.display_name, v_nome) END,\n",
    errori,
    "c: update",
  );
  atteso = sostituisci(atteso, "VALUES (p_user_id, '+' || g.n, v_nome, g.ultimo, v_risp, 'baileys')", "VALUES (p_user_id, '+' || g.n, NULL, g.ultimo, v_risp, 'baileys')", errori, "c: insert");
  atteso = sostituisci(
    atteso,
    "               display_name    = coalesce(w.display_name, excluded.display_name),\n",
    "               display_name    = CASE WHEN w.origine = 'baileys' AND w.lead_id IS NULL THEN w.display_name\n                                      ELSE coalesce(w.display_name, v_nome) END,\n",
    errori,
    "c: conflitto",
  );
  c("le sette sostituzioni trovano ognuna il suo punto nella v1 (una volta sola)", [], errori);
  const righeAttese = atteso.split("\n");
  const righeV2 = v2pulita.split("\n");
  const prima = righeAttese.findIndex((r, i) => r !== righeV2[i]);
  c("il corpo di ponte_wa_scrivi v2, tolti i commenti marcati, è IDENTICO alla v1 più le tre modifiche (nessun'altra differenza)",
    { riga: -1, atteso: null, avuto: null, righe: righeAttese.length },
    prima < 0 && righeAttese.length === righeV2.length
      ? { riga: -1, atteso: null, avuto: null, righe: righeV2.length }
      : { riga: prima, atteso: righeAttese[prima] ?? "(fine)", avuto: righeV2[prima] ?? "(fine)", righe: righeV2.length });
  //  Il corpo di scrivi non nomina le colonne dei non letti e dell'entrata (I2): lo fanno solo promuovi e ritira.
  c("scrivi v2 non nomina non letti, ultima entrata, scheda, id ManyChat, STOP come colonne da scrivere (I2)", [],
    ["unread_count", "ultimo_in_entrata_il", "ultimo_in_entrata_anteprima", "subscriber_id", "non_scrivere_dal", "manychat_"].filter((k) => senzaCommenti(v2).includes(k)));
  c("scrivi v2 nomina lead_id solo per decidere il nome (due volte «lead_id IS NULL», mai da scrivere)", [2, 2], [
    (senzaCommenti(v2).match(/lead_id/g) ?? []).length,
    (senzaCommenti(v2).match(/lead_id IS NULL/g) ?? []).length,
  ]);

  /* ── forma del file ───────────────────────────────────────────────────── */
  c("le parentesi tornano", 0, [...sql].reduce((n, ch) => n + (ch === "(" ? 1 : ch === ")" ? -1 : 0), 0));
  c("i delimitatori tra dollari si aprono e si chiudono", true,
    Object.values((sql.match(/\$\w*\$/g) ?? []).reduce((o, t) => ((o[t] = (o[t] ?? 0) + 1), o), {})).every((n) => n % 2 === 0));
  c("l'intestazione dice: NON la lancia la squadra, ordine, due volte, query di verifica e righe promosse, come si annulla", [true, true, true, true, true, true], [
    /NON la lancia la squadra/.test(grezzo),
    /ORDINE[^\n]*20261029120000_ponte_whatsapp\.sql/.test(grezzo),
    /due volte non fa danni/i.test(grezzo),
    /QUERY DI VERIFICA/.test(grezzo),
    /QUERY «RIGHE PROMOSSE»/.test(grezzo) && /promosso_il is not null/.test(grezzo),
    /COME SI ANNULLA/.test(grezzo),
  ]);
  c("l'intestazione dice che il nome del profilo non si salva e che lead_id ≠ «Con lead» (nota 6 del revisore)", true,
    /NOME DEL PROFILO/.test(grezzo) && /lead_id IS NULL/.test(grezzo) && /la chat lega la scheda per telefono/.test(grezzo));
  const altre = readdirSync(cartella).filter((n) => n.endsWith(".sql") && n !== FILE && !n.includes("ponte_immagini") && !n.includes("chat_veloce_indici") && !n.includes("rispiega") && !n.includes("eco_entrata_contatti") && !n.includes("ponte_revoche") && !n.includes("messaggi_automatici")); // messaggi automatici (interruttori 31/10), revoche (ponte-revoche 31/10) e chat veloce, rispiega, immagini (ponte-storico-completo) ed eco sul contatto (eco-manychat-entrata) vengono DOPO: hanno il loro ordine
  c("il nome viene dopo l'ultima migrazione esistente", true, FILE > altre.sort().at(-1));
}
