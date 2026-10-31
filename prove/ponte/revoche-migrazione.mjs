/** ── PROVE: LE REVOCHE DEL PONTE · LA MIGRAZIONE (testo) ─────────────────────
 *
 *  Commessa 2026-10-31, ponte-revoche. `supabase/migrations/20261031090000_ponte_revoche.sql` è SOLO
 *  aggiuntiva: una colonna e una funzione. Il comportamento vero lo prova il collaudo su Postgres
 *  (`prove/sql/ponte-revoche.sql`, con `pg-prova.sh`); qui si leggono le regole che il testo deve
 *  rispettare per sempre: niente DELETE, solo le nostre uscite, funzione chiusa al browser.
 *
 *  `mod`: i moduli impacchettati da `prove/prove.mjs`. `aiuti`: `{ c, gruppo, radice }`. */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export async function provePonteRevocheMigrazione(_mod, { c, gruppo, radice }) {
  gruppo("PONTE WHATSAPP · REVOCHE · MIGRAZIONE (solo aggiuntiva, funzione chiusa al browser)");
  const nome = "20261031090000_ponte_revoche.sql";
  const file = join(radice, "supabase/migrations", nome);
  c("la migrazione esiste con il nome chiesto", true, existsSync(file));
  const intero = readFileSync(file, "utf8");
  const sql = intero.replace(/--.*$/gm, "");

  c("è l'ultima per nome (viene dopo tutte le altre)", [], readdirSync(join(radice, "supabase/migrations")).filter((f) => f.endsWith(".sql") && f > nome && !f.includes("ponte_media") && !f.includes("meetly_diagnosi"))); // le tre dei media (31/10, media-e-archiviazione) vengono dopo: hanno il loro ordine
  c("niente DROP, DELETE, TRUNCATE (i dati restano), niente INSERT", [], ["DROP", "DELETE", "TRUNCATE", "INSERT"].filter((k) => new RegExp(`\\b${k}\\b`, "i").test(sql)));
  c("l'unico ALTER è l'aggiunta della colonna eliminato_il (IF NOT EXISTS)", ["ALTER TABLE public.whatsapp_messages ADD COLUMN IF NOT EXISTS eliminato_il timestamptz"], [...sql.matchAll(/ALTER TABLE[^;]*/gi)].map((m) => m[0].replace(/\s+/g, " ").trim()));
  c("niente indice, trigger o vincolo nuovi (la lettura filtra una colonna già dentro righe lette per altro)", [], ["CREATE INDEX", "CREATE UNIQUE", "CREATE TRIGGER", "ADD CONSTRAINT"].filter((k) => sql.toUpperCase().includes(k)));
  c("una sola funzione, ponte_wa_revoca(uuid, text), che si può riapplicare (OR REPLACE)", ["public.ponte_wa_revoca"], [...sql.matchAll(/CREATE OR REPLACE FUNCTION (public\.\w+)/g)].map((m) => m[1]));
  c("SECURITY DEFINER con il percorso fisso", true, /SECURITY DEFINER SET search_path = public, pg_temp/.test(sql));
  c("REVOKE a PUBLIC, anon, authenticated e GRANT al solo service_role", [true, ["service_role"]], [/REVOKE ALL ON FUNCTION public\.ponte_wa_revoca\(uuid, text\) FROM PUBLIC, anon, authenticated;/.test(sql), [...sql.matchAll(/GRANT EXECUTE ON FUNCTION public\.ponte_wa_revoca\(uuid, text\) TO (\w+)/g)].map((m) => m[1])]);
  c("controlla i parametri: utente e chiave bw:<8-15 cifre>:<id> (errore 22023)", true, /p_chiave !~ '\^bw:\[0-9\]\{8,15\}:\[A-Za-z0-9_\.-\]\{1,128\}\$'/.test(sql) && /ERRCODE = '22023'/.test(sql));
  c("trova la riga del ponte solo se è baileys E in uscita (un messaggio del cliente non si nasconde mai)", true, /w\.wa_message_id = p_chiave\s+AND w\.canale = 'baileys'\s+AND w\.direction = 'outbound'/.test(sql));
  c("marca solo nostre uscite, con eliminato_il IS NULL (una riga già marcata non si ritocca)", true, /direction = 'outbound'\s+AND \(w\.id = v_b\.id OR w\.id = v_b\.duplicato_di OR w\.duplicato_di = v_b\.id\)/.test(sql) && /SET eliminato_il = now\(\)\s+WHERE w\.id = ANY \(v_ids\)\s+AND w\.eliminato_il IS NULL/.test(sql));
  c("le UPDATE sono due: eliminato_il sui messaggi e il contatto (anteprima, last_message_at, risposto_il, updated_at)", [["public.whatsapp_messages"], ["public.whatsapp_contacts"]], [[...sql.matchAll(/UPDATE (public\.whatsapp_messages)/g)].map((m) => m[1]).slice(0, 1), [...sql.matchAll(/UPDATE (public\.whatsapp_contacts)/g)].map((m) => m[1])]);
  c("sul contatto non tocca i non letti, l'ultima entrata, il lead, lo STOP, l'abbonato", [], ["unread_count", "ultimo_in_entrata", "lead_id", "non_scrivere_dal", "subscriber_id"].filter((k) => sql.slice(sql.indexOf("UPDATE public.whatsapp_contacts")).split("WHERE k.id")[0].includes(k)));
  c("l'anteprima si riporta indietro solo se era proprio il messaggio eliminato (come l'eco), mai a caso", true, (sql.match(/k\.ultimo_messaggio_il = ANY \(v_quando\)/g) ?? []).length === 3);
  c("cambiato_il lo scrive il trigger di p1-chat-veloce (qui non si nomina)", false, /cambiato_il/.test(sql));
  c("l'intestazione dice 'dopo' le migrazioni da cui dipende e che non la lancia la squadra", [true, true, true], [/20261029120000_ponte_whatsapp\.sql/.test(intero), /20261030101100_p1-chat-veloce\.sql/.test(intero), /NON la lancia la squadra/.test(intero)]);
}
