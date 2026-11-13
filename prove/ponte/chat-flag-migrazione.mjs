/** ── PROVE: LA MIGRAZIONE «IL SEGNO HA_MESSAGGIO_PONTE» (testo SQL) ──
 *
 *  Commessa 2026-11-13-chat-baileys, filo A, T1 (PIANO.md). Come
 *  `prove/ponte/tutte-migrazione.mjs`: qui NON gira un Postgres, si legge il
 *  testo di `20261113120000_ponte_chat_flag.sql` (i commenti si TOLGONO
 *  prima). Il comportamento vero lo prova `prove/sql/ponte-chat-flag.sql` su
 *  un Postgres 16.
 *
 *  Il punto che il revisore ha chiesto per il piano v1→v2 (LAVAGNA.md):
 *  `ponte_wa_scrivi` e `ponte_wa_invio_esito` sono RIDEFINITE, e il loro corpo
 *  deve differire da quello già in produzione (20261030160000 e 20261030120000)
 *  SOLO per le tre aggiunte marcate `-- SEGNO PONTE (2026-11-13):` ciascuna.
 *  La prova costruisce il corpo atteso applicando alle versioni vecchie le tre
 *  sostituzioni di ciascuna funzione e lo confronta riga per riga con la
 *  nuova (senza i commenti marcati): qualunque altra differenza la fa
 *  fallire.
 *  Dati inventati: nessun numero né nome vero.
 *
 *  `mod`: i moduli impacchettati da `prove/prove.mjs`. `aiuti`: `{ c, gruppo, radice }`. */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const FILE = "20261113120000_ponte_chat_flag.sql";
const FILE_SCRIVI = "20261030160000_ponte_tutte_le_chat.sql";
const FILE_INVIO = "20261030120000_ponte_invio_manuale.sql";
/** Impronte (sha-256) delle due migrazioni che questa commessa NON tocca. */
const IMPRONTA_SCRIVI = "2fd79287454e516cefb2d6956a40d420aae7d10ea47ce9072aaf764c4f169980";
const IMPRONTA_INVIO = "a981fd0a6df2aee94f91a47be862c89593972f78b95804acff4db89c94740f8b";

const senzaCommenti = (sql) =>
  sql
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/--[^\n]*/g, "")
    .replace(/[ \t]+\n/g, "\n");

/** Il corpo di una funzione: dal suo CREATE al `END $$;`/`END; $$;` che la chiude. */
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

export async function provePonteChatFlagMigrazione(_mod, { c, gruppo, radice }) {
  gruppo("PONTE WHATSAPP · IL SEGNO HA_MESSAGGIO_PONTE · LA MIGRAZIONE (TESTO)");
  const cartella = join(radice, "supabase/migrations");
  const percorso = join(cartella, FILE);
  c("la migrazione esiste col nome del piano", true, existsSync(percorso));
  if (!existsSync(percorso)) return;

  const grezzo = readFileSync(percorso, "utf8");
  const sql = senzaCommenti(grezzo);
  const scriviGrezzo = readFileSync(join(cartella, FILE_SCRIVI), "utf8");
  const invioGrezzo = readFileSync(join(cartella, FILE_INVIO), "utf8");

  /* ── solo aggiunte ────────────────────────────────────────────────────── */
  c(
    "le due migrazioni che questa commessa non tocca sono IDENTICHE",
    [IMPRONTA_SCRIVI, IMPRONTA_INVIO],
    [
      createHash("sha256").update(scriviGrezzo).digest("hex"),
      createHash("sha256").update(invioGrezzo).digest("hex"),
    ],
  );
  c(
    "niente DELETE, TRUNCATE, DROP FUNCTION/TABLE/COLUMN fuori dai commenti (solo il DROP TRIGGER IF EXISTS per la ridefinizione idempotente)",
    [false, false, 0, 0, 1],
    [
      /\bDELETE\b/.test(sql.toUpperCase()),
      /\bTRUNCATE\b/.test(sql.toUpperCase()),
      (sql.match(/DROP (FUNCTION|TABLE|COLUMN)/gi) ?? []).length,
      (sql.match(/DROP INDEX/gi) ?? []).length,
      (sql.match(/DROP TRIGGER IF EXISTS/gi) ?? []).length,
    ],
  );
  c(
    "«come si annulla» c'è, ma solo nel commento (DROP del trigger, della funzione, della colonna)",
    [true, true, true],
    [
      /COME SI ANNULLA/i.test(grezzo),
      /DROP TRIGGER trg_wa_messaggi_ponte_segno/i.test(grezzo) &&
        !senzaCommenti(grezzo).includes("DROP TRIGGER trg_wa_messaggi_ponte_segno"),
      /ALTER TABLE public\.whatsapp_contacts DROP COLUMN ha_messaggio_ponte/i.test(grezzo) &&
        !sql.includes("DROP COLUMN ha_messaggio_ponte"),
    ],
  );
  c(
    "la colonna nuova: ADD COLUMN IF NOT EXISTS, booleana, NOT NULL DEFAULT false",
    true,
    /ALTER TABLE public\.whatsapp_contacts\s+ADD COLUMN IF NOT EXISTS ha_messaggio_ponte boolean NOT NULL DEFAULT false;/.test(
      sql,
    ),
  );
  c(
    "solo CREATE OR REPLACE (nessun CREATE FUNCTION secco)",
    [["ponte_wa_invio_esito", "ponte_wa_scrivi", "wa_messaggio_ponte_segno"], 0],
    [
      [...sql.matchAll(/CREATE OR REPLACE FUNCTION public\.(\w+)/g)].map((x) => x[1]).sort(),
      (sql.match(/CREATE FUNCTION/g) ?? []).length,
    ],
  );
  c(
    "nessuna tabella creata, nessuna policy, nessun indirizzo scritto a mano",
    [0, 0, false],
    [
      (sql.match(/CREATE TABLE/g) ?? []).length,
      (sql.match(/CREATE POLICY/g) ?? []).length,
      /https?:\/\//i.test(grezzo),
    ],
  );

  /* ── il trigger, seconda rete ─────────────────────────────────────────── */
  const segno = corpoFunzione(sql, "wa_messaggio_ponte_segno");
  c(
    "wa_messaggio_ponte_segno: SECURITY DEFINER con search_path fisso, RETURNS trigger",
    true,
    /RETURNS trigger/.test(segno) &&
      /SECURITY DEFINER SET search_path = public, pg_temp/.test(segno),
  );
  c(
    "wa_messaggio_ponte_segno: esce subito se non è baileys o non ci sono cifre",
    true,
    /NEW\.canale IS DISTINCT FROM 'baileys' THEN RETURN NULL/.test(segno) &&
      /v_cifre = '' THEN RETURN NULL/.test(segno),
  );
  c(
    "wa_messaggio_ponte_segno: solo UPDATE indicizzato (user_id, phone_e164), mai una scansione, mai sui falsi già veri",
    true,
    /UPDATE public\.whatsapp_contacts c/.test(segno) &&
      /c\.user_id = NEW\.user_id/.test(segno) &&
      /c\.phone_e164 IN \('\+' \|\| v_cifre, v_cifre\)/.test(segno) &&
      /AND c\.ha_messaggio_ponte = false/.test(segno) &&
      !/SELECT.*FROM public\.whatsapp_messages/is.test(segno),
  );
  c(
    "il trigger: AFTER INSERT su whatsapp_messages, WHEN canale='baileys' (non scatta sui messaggi normali)",
    true,
    /CREATE TRIGGER trg_wa_messaggi_ponte_segno\s+AFTER INSERT ON public\.whatsapp_messages\s+FOR EACH ROW WHEN \(NEW\.canale = 'baileys'\)\s+EXECUTE FUNCTION public\.wa_messaggio_ponte_segno\(\);/.test(
      sql,
    ),
  );
  c(
    "wa_messaggio_ponte_segno: chiuso a PUBLIC, anon, authenticated (solo il trigger lo esegue)",
    true,
    sql.includes(
      "REVOKE ALL ON FUNCTION public.wa_messaggio_ponte_segno() FROM PUBLIC, anon, authenticated;",
    ),
  );
  c("NOTIFY pgrst per ricaricare lo schema", true, /NOTIFY pgrst, 'reload schema'\s*;/.test(sql));

  /* ── le marcature SEGNO PONTE: esattamente tre per funzione, niente altrove ── */
  const scriviNuovo = corpoFunzione(grezzo, "ponte_wa_scrivi");
  const invioNuovo = corpoFunzione(grezzo, "ponte_wa_invio_esito");
  const marcateScrivi = scriviNuovo
    .split("\n")
    .filter((r) => /^\s*-- SEGNO PONTE \(2026-11-13\):/.test(r));
  const marcateInvio = invioNuovo
    .split("\n")
    .filter((r) => /^\s*-- SEGNO PONTE \(2026-11-13\):/.test(r));
  c(
    "ponte_wa_scrivi: tre righe marcate (ramo UPDATE, ramo INSERT, ramo ON CONFLICT)",
    3,
    marcateScrivi.length,
  );
  c(
    "ponte_wa_invio_esito: tre righe marcate (ramo UPDATE, ramo INSERT, ramo ON CONFLICT)",
    3,
    marcateInvio.length,
  );
  c(
    "nessun'altra marcatura SEGNO PONTE nel resto del file",
    6,
    (grezzo.match(/-- SEGNO PONTE \(2026-11-13\):/g) ?? []).length,
  );

  /* ── ponte_wa_scrivi nuova = vecchia (20261030160000) + le tre aggiunte, NIENT'ALTRO ── */
  {
    const vecchio = corpoFunzione(scriviGrezzo, "ponte_wa_scrivi");
    c(
      "scrivi: stessa firma della v2 già in produzione",
      true,
      vecchio.startsWith(
        "CREATE OR REPLACE FUNCTION public.ponte_wa_scrivi(\n  p_user_id uuid,\n  p_righe jsonb,\n  p_pari jsonb,\n  p_nomi jsonb\n) RETURNS jsonb",
      ) &&
        scriviNuovo.startsWith(
          "CREATE OR REPLACE FUNCTION public.ponte_wa_scrivi(\n  p_user_id uuid,\n  p_righe jsonb,\n  p_pari jsonb,\n  p_nomi jsonb\n) RETURNS jsonb",
        ),
    );
    const nuovaPulita = scriviNuovo
      .split("\n")
      .filter((r) => !/^\s*-- SEGNO PONTE \(2026-11-13\):/.test(r))
      .join("\n");

    const errori = [];
    let atteso = vecchio;
    atteso = sostituisci(
      atteso,
      "      IF v_id IS NOT NULL THEN\n        UPDATE public.whatsapp_contacts x\n           SET last_message_at = greatest(x.last_message_at, g.ultimo),\n",
      "      IF v_id IS NOT NULL THEN\n        UPDATE public.whatsapp_contacts x\n           SET ha_messaggio_ponte = true,\n               last_message_at = greatest(x.last_message_at, g.ultimo),\n",
      errori,
      "ramo UPDATE",
    );
    atteso = sostituisci(
      atteso,
      "        INSERT INTO public.whatsapp_contacts AS w (user_id, phone_e164, display_name, last_message_at, risposto_il, origine)\n        -- TUTTE LE CHAT: (c) un contatto nuovo del ponte nasce senza nome (è uno sconosciuto).\n        VALUES (p_user_id, '+' || g.n, NULL, g.ultimo, v_risp, 'baileys')\n",
      "        INSERT INTO public.whatsapp_contacts AS w (user_id, phone_e164, display_name, last_message_at, risposto_il, origine, ha_messaggio_ponte)\n        -- TUTTE LE CHAT: (c) un contatto nuovo del ponte nasce senza nome (è uno sconosciuto).\n        VALUES (p_user_id, '+' || g.n, NULL, g.ultimo, v_risp, 'baileys', true)\n",
      errori,
      "ramo INSERT",
    );
    atteso = sostituisci(
      atteso,
      "        ON CONFLICT (user_id, phone_e164) DO UPDATE\n           SET last_message_at = greatest(w.last_message_at, excluded.last_message_at),\n",
      "        ON CONFLICT (user_id, phone_e164) DO UPDATE\n           SET ha_messaggio_ponte = true,\n               last_message_at = greatest(w.last_message_at, excluded.last_message_at),\n",
      errori,
      "ramo ON CONFLICT",
    );
    c(
      "scrivi: le tre sostituzioni trovano ognuna il suo punto nella versione vecchia (una volta sola)",
      [],
      errori,
    );
    const righeAttese = atteso.split("\n");
    const righeNuove = nuovaPulita.split("\n");
    const prima = righeAttese.findIndex((r, i) => r !== righeNuove[i]);
    c(
      "scrivi: il corpo nuovo, tolti i commenti marcati, è IDENTICO alla versione vecchia più le tre aggiunte (nessun'altra differenza)",
      { riga: -1, atteso: null, avuto: null, righe: righeAttese.length },
      prima < 0 && righeAttese.length === righeNuove.length
        ? { riga: -1, atteso: null, avuto: null, righe: righeNuove.length }
        : {
            riga: prima,
            atteso: righeAttese[prima] ?? "(fine)",
            avuto: righeNuove[prima] ?? "(fine)",
            righe: righeNuove.length,
          },
    );
  }

  /* ── ponte_wa_invio_esito nuova = vecchia (20261030120000) + le tre aggiunte, NIENT'ALTRO ── */
  {
    const vecchio = corpoFunzione(invioGrezzo, "ponte_wa_invio_esito");
    c(
      "invio_esito: stessa firma di oggi",
      true,
      vecchio.startsWith(
        "CREATE OR REPLACE FUNCTION public.ponte_wa_invio_esito(\n  p_user_id uuid,\n  p_id uuid,\n  p_esito text,\n  p_wa_id text,\n  p_ts double precision,\n  p_motivo text\n) RETURNS jsonb",
      ) &&
        invioNuovo.startsWith(
          "CREATE OR REPLACE FUNCTION public.ponte_wa_invio_esito(\n  p_user_id uuid,\n  p_id uuid,\n  p_esito text,\n  p_wa_id text,\n  p_ts double precision,\n  p_motivo text\n) RETURNS jsonb",
        ),
    );
    const nuovaPulita = invioNuovo
      .split("\n")
      .filter((r) => !/^\s*-- SEGNO PONTE \(2026-11-13\):/.test(r))
      .join("\n");

    const errori = [];
    let atteso = vecchio;
    atteso = sostituisci(
      atteso,
      "    IF v_cid IS NOT NULL THEN\n      UPDATE public.whatsapp_contacts x\n         SET last_message_at = greatest(x.last_message_at, v_ora),\n",
      "    IF v_cid IS NOT NULL THEN\n      UPDATE public.whatsapp_contacts x\n         SET ha_messaggio_ponte = true,\n             last_message_at = greatest(x.last_message_at, v_ora),\n",
      errori,
      "ramo UPDATE",
    );
    atteso = sostituisci(
      atteso,
      "    ELSE\n      INSERT INTO public.whatsapp_contacts AS w (user_id, phone_e164, last_message_at, risposto_il, origine)\n      VALUES (p_user_id, '+' || r.numero, v_ora, least(v_ora, now()), 'baileys')\n",
      "    ELSE\n      INSERT INTO public.whatsapp_contacts AS w (user_id, phone_e164, last_message_at, risposto_il, origine, ha_messaggio_ponte)\n      VALUES (p_user_id, '+' || r.numero, v_ora, least(v_ora, now()), 'baileys', true)\n",
      errori,
      "ramo INSERT",
    );
    atteso = sostituisci(
      atteso,
      "      ON CONFLICT (user_id, phone_e164) DO UPDATE\n         SET last_message_at = greatest(w.last_message_at, excluded.last_message_at),\n",
      "      ON CONFLICT (user_id, phone_e164) DO UPDATE\n         SET ha_messaggio_ponte = true,\n             last_message_at = greatest(w.last_message_at, excluded.last_message_at),\n",
      errori,
      "ramo ON CONFLICT",
    );
    c(
      "invio_esito: le tre sostituzioni trovano ognuna il suo punto nella versione vecchia (una volta sola)",
      [],
      errori,
    );
    const righeAttese = atteso.split("\n");
    const righeNuove = nuovaPulita.split("\n");
    const prima = righeAttese.findIndex((r, i) => r !== righeNuove[i]);
    c(
      "invio_esito: il corpo nuovo, tolti i commenti marcati, è IDENTICO alla versione vecchia più le tre aggiunte (nessun'altra differenza)",
      { riga: -1, atteso: null, avuto: null, righe: righeAttese.length },
      prima < 0 && righeAttese.length === righeNuove.length
        ? { riga: -1, atteso: null, avuto: null, righe: righeNuove.length }
        : {
            riga: prima,
            atteso: righeAttese[prima] ?? "(fine)",
            avuto: righeNuove[prima] ?? "(fine)",
            righe: righeNuove.length,
          },
    );
  }

  /* ── il riempimento una tantum ─────────────────────────────────────────── */
  c(
    "il riempimento una tantum: filtrato su canale='baileys', non riaccende chi è già true, confronta le cifre",
    true,
    /WHERE w\.canale = 'baileys'/.test(sql) &&
      /UPDATE public\.whatsapp_contacts c SET ha_messaggio_ponte = true/.test(sql) &&
      /AND c\.ha_messaggio_ponte = false;/.test(sql) &&
      /regexp_replace\(c\.phone_e164, '\\D', '', 'g'\) = n\.cifre/.test(sql),
  );

  /* ── forma del file ───────────────────────────────────────────────────── */
  c(
    "le parentesi tornano",
    0,
    [...sql].reduce((n, ch) => n + (ch === "(" ? 1 : ch === ")" ? -1 : 0), 0),
  );
  c(
    "i delimitatori tra dollari si aprono e si chiudono",
    true,
    Object.values(
      (sql.match(/\$\w*\$/g) ?? []).reduce((o, t) => ((o[t] = (o[t] ?? 0) + 1), o), {}),
    ).every((n) => n % 2 === 0),
  );
  c(
    "l'intestazione dice: NON la lancia la squadra, ordine, due volte, query di verifica, come si annulla",
    [true, true, true, true, true],
    [
      /NON la lancia la squadra/.test(grezzo),
      /ORDINE[^\n]*20261030160000_ponte_tutte_le_chat\.sql/.test(grezzo) &&
        /20261030120000_ponte_invio_manuale\.sql/.test(grezzo),
      /due volte non fa danni/i.test(grezzo),
      /QUERY DI VERIFICA/.test(grezzo),
      /COME SI ANNULLA/.test(grezzo),
    ],
  );
  const altre = readdirSync(cartella).filter((n) => n.endsWith(".sql") && n !== FILE);
  c("il nome viene dopo l'ultima migrazione esistente", true, FILE > altre.sort().at(-1));
}
