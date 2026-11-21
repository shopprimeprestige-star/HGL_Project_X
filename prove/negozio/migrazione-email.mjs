/** ── SHOP R2 · T43 · S6 · LA MIGRAZIONE DEI MODELLI EMAIL (TESTO SQL) ──────────────────────────────────────
 *  Qui NON gira un Postgres: si legge il testo di `20261122140000_shop_email.sql` (COMMENTI TOLTI prima).
 *  Il comportamento vero sta in `prove/sql/shop-email.sql` (Postgres usa-e-getta, condizione di merge). La applica il TITOLARE.
 *  Cosa deve valere (PIANO-R2 §4 «S6», D53):
 *   · `shop_email_modelli` con le CINQUE righe seme di `CHIAVI_EMAIL` (le stesse del finto), tutte `acceso = false`, tutte con
 *     `{{da confermare}}`, firmate «Hair Genius Labs», `approvato_*` mai scritti, `ON CONFLICT (chiave) DO NOTHING`;
 *   · solo aggiunte: nessun DELETE, DROP, TRUNCATE in nessun punto (commenti compresi); nessun UPDATE fuori dai corpi delle
 *     funzioni; dentro i corpi si aggiorna solo `shop_email_modelli` e, per prenota/esito, la colonna `email_inviate` di `shop_orders`;
 *   · le cinque funzioni hanno i nomi e i parametri `p_…` del contratto del finto (T40), girano come proprietario con
 *     `search_path` fisso, blocco di riga (`FOR UPDATE`), e solo `service_role` le esegue;
 *   · gli errori hanno il testo e lo SQLSTATE di `ERRORI_SQL_R2` del finto: il finto e il SQL non possono divergere in silenzio;
 *   · tabella chiusa: RLS accesa, nessuna policy, nessuna scrittura diretta nemmeno da `service_role` (solo SELECT);
 *   · il database rifiuta da sé di avere un modello acceso senza approvazione sull'impronta o con `{{` (CHECK, anche scrivendo a mano);
 *   · nessun indirizzo dello studio nei testi. */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CHIAVI_EMAIL, ERRORI_SQL_R2, FUNZIONI_R2 } from "./_finto-db.mjs";

const FILE = "20261122140000_shop_email.sql";
const senzaCommenti = (sql) => sql.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--[^\n]*/g, "").replace(/[ \t]+\n/g, "\n");
const piatto = (s) => s.replace(/\s+/g, " ").trim();

export async function prove(mod, { c, gruppo, radice }) {
  gruppo("SHOP R2 · T43 · S6 · MODELLI EMAIL: TESTO SQL (21/11/2026)");
  const percorso = join(radice, "supabase/migrations", FILE);
  const sqlProva = join(radice, "prove/sql/shop-email.sql");
  c("la migrazione esiste col nome deciso dal piano e il collaudo su Postgres usa-e-getta c'è", [true, true], [existsSync(percorso), existsSync(sqlProva)]);
  if (!existsSync(percorso)) return;

  const grezzo = readFileSync(percorso, "utf8");
  const sql = senzaCommenti(grezzo);
  const corpi = [...sql.matchAll(/\$\$([\s\S]*?)\$\$/g)].map((m) => m[1]);
  const fuori = sql.replace(/\$\$[\s\S]*?\$\$/g, () => "$$…$$");
  const stmt = fuori.split(";").map(piatto).filter(Boolean);
  const nomiFunzioni = FUNZIONI_R2.S6;

  /* ── solo aggiunte ── */
  c("nessun DELETE, DROP, TRUNCATE in nessun punto del file (commenti e corpi compresi)", [0, 0, 0], [/\bDELETE\b/i, /\bDROP\b/i, /\bTRUNCATE\b/i].map((r) => (r.test(grezzo) ? 1 : 0)));
  c("nessun UPDATE, ALTER, RENAME, DO fuori dai corpi delle funzioni, tranne il controllo iniziale (un DO che non scrive)", [0, 0, 0], [
    /\bUPDATE\b/i.test(fuori), /\bALTER TABLE\b(?![^;]*ENABLE ROW LEVEL SECURITY)/i.test(fuori), /\bRENAME\b/i.test(fuori),
  ].map(Number));
  c("fuori dai corpi c'è solo: il controllo iniziale, CREATE TABLE/INDEX, ENABLE RLS, REVOKE, GRANT, il seme, CREATE OR REPLACE FUNCTION, NOTIFY", [], stmt.filter((s) =>
    !(/^(BEGIN|COMMIT)$/.test(s) ||
      /^DO \$\$…\$\$$/.test(s) ||
      /^CREATE TABLE IF NOT EXISTS public\.shop_email_modelli \(/.test(s) ||
      s === "ALTER TABLE public.shop_email_modelli ENABLE ROW LEVEL SECURITY" ||
      /^(REVOKE ALL ON TABLE public\.shop_email_modelli FROM (PUBLIC, anon, authenticated|service_role)|GRANT SELECT ON TABLE public\.shop_email_modelli TO service_role)$/.test(s) ||
      /^INSERT INTO public\.shop_email_modelli \(chiave, oggetto, testo\) VALUES .* ON CONFLICT \(chiave\) DO NOTHING$/.test(s) ||
      /^CREATE OR REPLACE FUNCTION public\.shop_email_[a-z_]+\(.*\) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS \$\$…\$\$$/.test(s) ||
      /^(REVOKE ALL ON FUNCTION|GRANT EXECUTE ON FUNCTION) public\.shop_email_[a-z_]+\(.*\) (FROM PUBLIC, anon, authenticated|TO service_role)$/.test(s) ||
      s === "NOTIFY pgrst, 'reload schema'")));

  /* ── il controllo iniziale: senza S4 (colonna email_inviate) si ferma, senza scrivere ── */
  const primoDo = /^[\s\S]*?\$\$([\s\S]*?)\$\$/.exec(sql.slice(sql.indexOf("DO $$")))?.[1] ?? "";
  c("il controllo iniziale guarda `email_inviate` di `shop_orders` (S4) e `shop_storico` (S1) e si ferma con un messaggio chiaro, senza scrivere", [true, true, true, false], [
    /email_inviate/.test(primoDo) && /shop_orders/.test(primoDo), /shop_storico/.test(primoDo), /RAISE EXCEPTION/.test(primoDo), /\b(INSERT|UPDATE|CREATE)\b/i.test(primoDo),
  ]);

  /* ── la tabella e il seme ── */
  const tabella = /CREATE TABLE IF NOT EXISTS public\.shop_email_modelli \(([\s\S]*?)\n\);/.exec(sql)?.[1] ?? "";
  c("la tabella ha le colonne di D53 (chiave PK con le sole cinque chiavi, oggetto, testo, acceso, approvato_da/il/hash, aggiornato_il)", [], [
    "chiave", "oggetto", "testo", "acceso", "approvato_da", "approvato_il", "approvato_hash", "aggiornato_il",
  ].filter((k) => !new RegExp(`\\b${k}\\b`).test(tabella)));
  c("`chiave` è chiave primaria e il CHECK le ammette tutte e sole le cinque del finto", [true, CHIAVI_EMAIL.slice().sort().join()], [
    /chiave\s+text\s+PRIMARY KEY/.test(tabella),
    [...(/chiave IN \(([^)]*)\)/.exec(tabella)?.[1] ?? "").matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort().join(),
  ]);
  c("`acceso` nasce falso e il database rifiuta (CHECK) un modello acceso senza approvazione sull'impronta di oggetto+testo o con `{{`", [true, true, true, true], [
    /acceso\s+boolean\s+NOT NULL DEFAULT false/.test(tabella),
    /CHECK \(NOT acceso OR/.test(piatto(tabella)),
    piatto(tabella).includes("approvato_hash = encode(sha256(convert_to(oggetto || E'\\n' || testo, 'UTF8')), 'hex')"),
    /position\('\{\{' IN oggetto\) = 0/.test(tabella) && /position\('\{\{' IN testo\) = 0/.test(tabella),
  ]);
  const seme = /INSERT INTO public\.shop_email_modelli \(chiave, oggetto, testo\) VALUES([\s\S]*?)ON CONFLICT \(chiave\) DO NOTHING/.exec(sql)?.[1] ?? "";
  const righeSeme = [...seme.matchAll(/\(\s*'([a-z_]+)'\s*,\s*'((?:[^']|'')*)'\s*,\s*E?'((?:[^']|'')*)'\s*\)/g)].map((m) => ({ chiave: m[1], oggetto: m[2], testo: m[3] }));
  c("cinque righe seme, le chiavi del finto, una per una", CHIAVI_EMAIL.slice().sort(), righeSeme.map((r) => r.chiave).sort());
  c("il seme scrive solo chiave, oggetto, testo: `acceso` resta falso e `approvato_*` vuoti (nessuna riga nasce accesa o approvata)", [false, false], [
    /\bacceso\b/.test(seme) || /INSERT INTO public\.shop_email_modelli \([^)]*acceso/.test(sql), /approvato_/.test(seme) || /INSERT INTO public\.shop_email_modelli \([^)]*approvato/.test(sql),
  ]);
  c("ogni testo seme (oggetto e testo) porta `{{da confermare}}`: nessun seme si può accendere", [], righeSeme.filter((r) => !r.oggetto.includes("{{da confermare}}") || !r.testo.includes("{{da confermare}}")).map((r) => r.chiave));
  c("il mittente è «Hair Genius Labs» in ogni testo seme", [], righeSeme.filter((r) => !r.testo.includes("Hair Genius Labs")).map((r) => r.chiave));
  c("nessun indirizzo dello studio nei testi: niente via/viale/piazza/corso con nome, niente CAP di 5 cifre, niente numeri civici", [], [
    ...(seme.match(/\b(via|viale|piazza|piazzale|corso|largo|vicolo)\s+[A-Z0-9]/gi) ?? []), ...(sql.match(/\b\d{5}\b/g) ?? []), ...(seme.match(/\b(civico|n\.\s?\d+|c\.a\.p)/gi) ?? []),
  ]);
  c("nessuna cifra di Invisible Derm, nessuna consulenza, nessun upsell nei testi seme (SPEC §15 n. 13)", [], righeSeme.filter((r) => /invisible|consulenza|sconto|offerta|€/i.test(r.oggetto + r.testo)).map((r) => r.chiave));

  /* ── tabella chiusa ── */
  c("RLS accesa, NESSUNA policy, REVOKE ALL a PUBLIC/anon/authenticated e anche a service_role, poi solo SELECT a service_role", [true, false, true, true, true], [
    stmt.includes("ALTER TABLE public.shop_email_modelli ENABLE ROW LEVEL SECURITY"), /CREATE POLICY/i.test(sql),
    stmt.includes("REVOKE ALL ON TABLE public.shop_email_modelli FROM PUBLIC, anon, authenticated"),
    stmt.includes("REVOKE ALL ON TABLE public.shop_email_modelli FROM service_role"),
    stmt.includes("GRANT SELECT ON TABLE public.shop_email_modelli TO service_role"),
  ]);
  c("nessun GRANT di scrittura sulla tabella (solo SELECT) e nessun accesso ad anon/authenticated", [0, 0], [
    stmt.filter((s) => /^GRANT /.test(s) && /TABLE public\.shop_email_modelli/.test(s) && !/^GRANT SELECT ON/.test(s)).length,
    stmt.filter((s) => /^GRANT /.test(s) && /\b(anon|authenticated)\b/.test(s)).length,
  ]);

  /* ── le cinque funzioni: nome, parametri, sicurezza, permessi ── */
  const FIRME = {
    shop_email_modello_salva: "p_chiave text, p_atteso timestamptz, p_oggetto text, p_testo text, p_chi text",
    shop_email_modello_approva: "p_chiave text, p_impronta text, p_chi text",
    shop_email_modello_acceso: "p_chiave text, p_acceso boolean, p_chi text",
    shop_email_prenota: "p_ordine uuid, p_chiave text",
    shop_email_esito: "p_ordine uuid, p_chiave text, p_stato text, p_codice text",
  };
  c("le funzioni sono quelle del contratto (FUNZIONI_R2.S6) e sono cinque, con un corpo ciascuna", [nomiFunzioni.slice().sort(), 5], [Object.keys(FIRME).sort(), corpi.length - 1]);
  const funzioni = {};
  for (const m of sql.matchAll(/CREATE OR REPLACE FUNCTION public\.(shop_email_[a-z_]+)\(([^)]*)\)\s*RETURNS (\w+) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS \$\$([\s\S]*?)\$\$/g)) {
    funzioni[m[1]] = { firma: piatto(m[2]).replace(/ ,/g, ","), ritorna: m[3], corpo: m[4] };
  }
  c("parametri `p_…` esatti, nell'ordine del contratto", [], nomiFunzioni.filter((n) => funzioni[n]?.firma !== FIRME[n]));
  c("tutte rispondono `boolean` (come nel finto)", [], nomiFunzioni.filter((n) => funzioni[n]?.ritorna !== "boolean"));
  c("ognuna blocca la riga che legge (FOR UPDATE): due insieme non si pestano", [], nomiFunzioni.filter((n) => !/FOR UPDATE/.test(funzioni[n]?.corpo ?? "")));
  c("REVOKE a PUBLIC/anon/authenticated e GRANT EXECUTE al solo service_role, per ogni funzione", [], nomiFunzioni.filter((n) => {
    const tipi = FIRME[n].split(",").map((p) => p.trim().split(" ")[1]).join(", ");
    return !stmt.includes(`REVOKE ALL ON FUNCTION public.${n}(${tipi}) FROM PUBLIC, anon, authenticated`) || !stmt.includes(`GRANT EXECUTE ON FUNCTION public.${n}(${tipi}) TO service_role`);
  }));
  c("nessuna funzione è concessa ad anon o authenticated", 0, stmt.filter((s) => /^GRANT EXECUTE/.test(s) && /\b(anon|authenticated)\b/.test(s)).length);

  /* ── gli errori sono quelli del finto (testo e SQLSTATE) ── */
  const errori = [...corpi.join("\n").matchAll(/RAISE EXCEPTION '([a-z_]+)'\s+USING ERRCODE = '([a-z_]+)'/g)].map((m) => ({ nome: m[1], errcode: m[2] }));
  const tuttiRaise = (corpi.join("\n").match(/RAISE EXCEPTION/g) ?? []).length;
  c("ogni RAISE EXCEPTION ha il testo di un errore del finto e il suo ERRCODE", [tuttiRaise, []], [errori.length, errori.filter((e) => ERRORI_SQL_R2[e.nome]?.errcode !== e.errcode)]);
  c("gli errori che il piano e gli scenari chiedono ci sono tutti", [], ["modello_non_trovato", "modello_non_approvato", "modello_con_segnaposto", "ordine_non_trovato", "parametro_non_valido", "email_stato_non_valido"].filter((n) => !errori.some((e) => e.nome === n)));

  /* ── comportamento letto nel testo ── */
  const salva = funzioni.shop_email_modello_salva?.corpo ?? "";
  c("salva: confronto-e-scambio su aggiornato_il, spegne (acceso = false) e toglie l'approvazione (tre colonne a NULL), storico entita 'email'", [true, true, true, true], [
    /aggiornato_il IS DISTINCT FROM p_atteso/.test(salva),
    /acceso\s*=\s*false/.test(salva), /approvato_da\s*=\s*NULL/.test(salva) && /approvato_il\s*=\s*NULL/.test(salva) && /approvato_hash\s*=\s*NULL/.test(salva),
    /INSERT INTO public\.shop_storico[\s\S]*'email'/.test(salva),
  ]);
  const impronta = "encode(sha256(convert_to(oggetto || E'\\n' || testo, 'UTF8')), 'hex')";
  const approva = funzioni.shop_email_modello_approva?.corpo ?? "";
  c("approva: confronta l'impronta ricevuta con quella del testo ATTUALE (stessa formula del finto) e, se diversa, risponde false", [true, true], [
    piatto(approva).includes(impronta), /RETURN false/.test(approva),
  ]);
  const acceso = funzioni.shop_email_modello_acceso?.corpo ?? "";
  c("acceso: rifiuta se non approvato o con `{{` (due errori distinti); spegnere non chiede niente; risponde false se non cambia", [true, true, true], [
    /modello_non_approvato/.test(acceso) && /modello_con_segnaposto/.test(acceso), /position\('\{\{' IN/.test(acceso), /RETURN false/.test(acceso),
  ]);
  const prenota = funzioni.shop_email_prenota?.corpo ?? "";
  c("prenota: `inviata` mai più, `in_invio` blocca per 5 minuti (interval '5 minutes'), scrive `in_invio` su email_inviate (che dopo `errore` si riprenoti lo prova lo script SQL)", [true, true, true], [
    /'inviata'/.test(prenota), /interval '5 minutes'/.test(prenota), /'in_invio'/.test(prenota) && /email_inviate\s*=/.test(prenota),
  ]);
  const esito = funzioni.shop_email_esito?.corpo ?? "";
  c("esito: accetta solo `inviata` e `errore` (email_stato_non_valido), scrive `email_inviate[chiave]` e una riga di storico entita 'email'", [true, true, true], [
    /p_stato IS NULL OR p_stato NOT IN \('inviata', 'errore'\)/.test(esito), /email_inviate\s*=/.test(esito), /INSERT INTO public\.shop_storico[\s\S]*'email'/.test(esito),
  ]);
  c("dentro i corpi si aggiorna solo shop_email_modelli (salva, approva, acceso) e shop_orders.email_inviate (prenota, esito); si inserisce solo in shop_storico", [[], []], [
    corpi.slice(1).flatMap((b) => [...b.matchAll(/\bUPDATE\s+public\.(\w+)/g)].map((m) => m[1])).filter((t) => !["shop_email_modelli", "shop_orders"].includes(t)),
    corpi.slice(1).flatMap((b) => [...b.matchAll(/\bINSERT INTO\s+public\.(\w+)/g)].map((m) => m[1])).filter((t) => t !== "shop_storico"),
  ]);
  c("l'UPDATE di shop_orders tocca solo email_inviate (e aggiornato_il): nessun altro campo dell'ordine", [], [prenota, esito].flatMap((b) => {
    const m = /UPDATE public\.shop_orders\s+SET([\s\S]*?)WHERE/.exec(b)?.[1] ?? "";
    return [...m.matchAll(/(?:^|,)\s*(\w+)\s*=/g)].map((x) => x[1]).filter((k) => !["email_inviate", "aggiornato_il"].includes(k));
  }));
  c("le funzioni non scrivono mai la mail né i dati del cliente nello storico (solo chiave, stato, codice)", 0, (esito.match(/\.(email|telefono|indirizzo|nome|cognome)\b/g) ?? []).length + (prenota.match(/\bNEW\.email|\.telefono|\.indirizzo/g) ?? []).length);
}
