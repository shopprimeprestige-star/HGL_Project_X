/** ── PROVE: CHAT WHATSAPP · LA MIGRAZIONE (LETTURA DEL TESTO) ──────────────────────────
 *
 *  Commessa 2026-10-28 (chat WhatsApp nel CRM), PIANO.md T1.
 *  Come `migrazioni.mjs`: qui NON gira un Postgres. Si legge il testo di
 *  `20261028120000_chat_whatsapp_crm.sql` (i commenti si TOLGONO prima: il
 *  «come si annulla» ha dei DROP scritti apposta e mai eseguiti) e si controlla
 *  che sia solo aggiuntivo, che le funzioni siano chiuse a chi deve, che la
 *  funzione della pausa sia quella di M1 salvo il blocco della pausa. Poi due
 *  piccoli MODELLI (prenotazione della porta, entrata del cliente) che fissano
 *  le scelte di D2/D3/D11 con i casi. I modelli non sostituiscono una prova su
 *  un Postgres vero: il revisore legge anche l'SQL.
 *
 *  Dati inventati: nessun numero vero.
 *
 *  `mod`: i moduli impacchettati da `prove/prove.mjs`. `aiuti`: `{ c, gruppo, radice }`. */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Il SQL senza commenti (`-- …` e il blocco slash-asterisco). Nessuna stringa dei file ha «--» dentro. */
const senzaCommenti = (sql) =>
  sql
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/--[^\n]*/g, "")
    .replace(/[ \t]+\n/g, "\n");

/** Toglie i corpi tra dollari (`$$…$$`, `$f$…$f$`, `$do$…$do$`): resta solo il «primo livello». */
const senzaCorpi = (sql) => sql.replace(/\$(\w*)\$[\s\S]*?\$\1\$/g, " ");

/** Il corpo di una funzione: dal suo CREATE al `$$;` che la chiude. */
const corpoFunzione = (sql, nome) => {
  const da = sql.indexOf(`FUNCTION public.${nome}(`);
  if (da < 0) return "";
  const fine = sql.indexOf("$$;", da);
  return sql.slice(da, fine < 0 ? undefined : fine + 3);
};

/** Spazi collassati: due testi uguali salvo l'impaginazione diventano la stessa stringa. */
const norm = (s) => s.replace(/\s+/g, " ").trim();

/** La dichiarazione della pausa: l'UNICA riga che la nuova funzione può cambiare rispetto a M1. */
const DICHIARA_PAUSA = /v_pausa_s\s+constant\s+int\s*:=\s*[^;]*;/;

/** Il testo di una funzione di prenotazione con la dichiarazione della pausa messa da parte. */
const senzaPausa = (testo) => norm(testo.replace(DICHIARA_PAUSA, "<PAUSA>"));

export async function proveChatMigrazione(mod, { c, gruppo, radice }) {
  gruppo("CHAT WHATSAPP · T1, LA MIGRAZIONE (TESTO)");

  const percorso = join(radice, "supabase/migrations/20261028120000_chat_whatsapp_crm.sql");
  const percorsoM1 = join(radice, "supabase/migrations/20261023120000_manychat_base.sql");
  c("la migrazione esiste col nome del piano", true, existsSync(percorso));
  c("M1 (la funzione della pausa) esiste", true, existsSync(percorsoM1));
  if (!existsSync(percorso) || !existsSync(percorsoM1)) return;

  const grezzo = readFileSync(percorso, "utf8");
  const sql = senzaCommenti(grezzo);
  const alto = sql.toUpperCase();
  const primoLivello = senzaCorpi(sql);
  const m1 = senzaCommenti(readFileSync(percorsoM1, "utf8"));

  /* ── solo aggiunte ────────────────────────────────────────────────────── */
  c(
    "niente DROP, DELETE, TRUNCATE fuori dai commenti",
    [false, false, false],
    [/\bDROP\b/.test(alto), /\bDELETE\b/.test(alto), /\bTRUNCATE\b/.test(alto)],
  );
  c(
    "…e il «come si annulla» c'è, ma solo nel commento (DROP FUNCTION ×3, DROP INDEX, DROP COLUMN ×4)",
    [true, 3, true, 4, true],
    [
      /COME SI ANNULLA/i.test(grezzo),
      (grezzo.match(/^--\s*DROP FUNCTION /gm) ?? []).length,
      /^--\s*DROP INDEX /m.test(grezzo),
      (grezzo.match(/^--[^\n]*DROP COLUMN /gm) ?? []).length,
      /^--[^\n]*manychat_base\.sql/m.test(grezzo),
    ],
  );
  c("…e COME SI ANNULLA non compare fuori dai commenti", false, /COME SI ANNULLA/i.test(sql));
  c(
    "primo livello (senza i corpi $$…$$): nessun UPDATE, INSERT, DELETE (nessun riempimento dei dati vecchi)",
    [false, false, false],
    [
      /\bUPDATE\b/i.test(primoLivello),
      /\bINSERT\b/i.test(primoLivello),
      /\bDELETE\b/i.test(primoLivello),
    ],
  );
  const alter = [...primoLivello.matchAll(/ALTER TABLE\s+(\S+)\s+([^;]*);/gi)];
  const colonne = [
    "ultimo_in_entrata_il",
    "ultimo_in_entrata_anteprima",
    "risposto_il",
    "subscriber_id",
  ];
  c(
    "ALTER TABLE: quattro, tutte su whatsapp_contacts",
    [4, true],
    [alter.length, alter.every(([, t]) => t === "public.whatsapp_contacts")],
  );
  c(
    "…tutte ADD COLUMN IF NOT EXISTS, sulle sole quattro colonne del piano (D1)",
    [...colonne].sort(),
    alter
      .map(([, , resto]) => resto.match(/^ADD COLUMN IF NOT EXISTS (\w+)\s/i)?.[1] ?? `NO:${resto}`)
      .sort(),
  );
  c(
    "…i tipi: timestamptz, text, timestamptz, text",
    [true, true, true, true],
    [
      /ADD COLUMN IF NOT EXISTS ultimo_in_entrata_il timestamptz\s*;/i.test(sql),
      /ADD COLUMN IF NOT EXISTS ultimo_in_entrata_anteprima text\s*;/i.test(sql),
      /ADD COLUMN IF NOT EXISTS risposto_il timestamptz\s*;/i.test(sql),
      /ADD COLUMN IF NOT EXISTS subscriber_id text\s*;/i.test(sql),
    ],
  );
  c(
    "nessuna colonna NOT NULL né DEFAULT (le righe vecchie restano vuote: nessuna riscrittura)",
    false,
    /ADD COLUMN[^;]*\b(NOT NULL|DEFAULT)\b/i.test(sql),
  );
  c(
    "nessuna policy, nessuna tabella nuova",
    [0, 0],
    [(sql.match(/CREATE POLICY/gi) ?? []).length, (sql.match(/CREATE TABLE/gi) ?? []).length],
  );

  /* ── si può applicare due volte ───────────────────────────────────────── */
  c(
    "CREATE INDEX con IF NOT EXISTS; niente CREATE FUNCTION senza OR REPLACE",
    [0, 0],
    [
      (sql.match(/CREATE (?:UNIQUE )?INDEX(?! IF NOT EXISTS)/gi) ?? []).length,
      (sql.match(/CREATE FUNCTION/gi) ?? []).length,
    ],
  );
  c(
    "l'indice è quello del piano (user_id, ultimo_in_entrata_il) WHERE ultimo_in_entrata_il IS NOT NULL",
    true,
    /CREATE INDEX IF NOT EXISTS idx_wa_contacts_da_rispondere\s+ON public\.whatsapp_contacts\s*\(user_id, ultimo_in_entrata_il\)\s*WHERE ultimo_in_entrata_il IS NOT NULL\s*;/i.test(
      sql,
    ),
  );
  c(
    "le parentesi tornano",
    0,
    [...sql].reduce((n, ch) => n + (ch === "(" ? 1 : ch === ")" ? -1 : 0), 0),
  );
  c(
    "i delimitatori tra dollari si aprono e si chiudono (ogni tag in numero pari)",
    true,
    Object.values(
      (sql.match(/\$\w*\$/g) ?? []).reduce((o, t) => ((o[t] = (o[t] ?? 0) + 1), o), {}),
    ).every((n) => n % 2 === 0),
  );
  c("NOTIFY pgrst per ricaricare lo schema", true, /NOTIFY pgrst, 'reload schema'\s*;/i.test(sql));
  c(
    "il commento in testa dice l'ORDINE (dopo M1) e che due volte non fa danni",
    [true, true, true],
    [
      /ORDINE[^\n]*(\n--[^\n]*)?[^\n]*20261023120000_manychat_base\.sql/i.test(grezzo),
      /due volte non fa danni/i.test(grezzo),
      /funziona anche SENZA/i.test(grezzo),
    ],
  );

  /* ── le tre funzioni della chat ───────────────────────────────────────── */
  const firme = {
    whatsapp_registra_entrata: "uuid, text, uuid, timestamptz, text, text, text",
    whatsapp_segna_risposto: "uuid, text",
    whatsapp_segna_fatto: "text",
  };
  for (const [nome, args] of Object.entries(firme)) {
    const f = corpoFunzione(sql, nome);
    c(
      `${nome}: esiste con la firma del piano, OR REPLACE`,
      true,
      new RegExp(`CREATE OR REPLACE FUNCTION public\\.${nome}\\(`, "i").test(sql) &&
        f.length > 0 &&
        new RegExp(`(REVOKE|GRANT)[^;]*public\\.${nome}\\(${args}\\)`, "i").test(sql),
    );
    c(`${nome}: search_path = public, pg_temp`, true, /SET search_path = public, pg_temp/i.test(f));
  }
  const reg = corpoFunzione(sql, "whatsapp_registra_entrata");
  const ris = corpoFunzione(sql, "whatsapp_segna_risposto");
  const fat = corpoFunzione(sql, "whatsapp_segna_fatto");
  c(
    "registra_entrata e segna_risposto: SECURITY DEFINER",
    [true, true],
    [/SECURITY DEFINER/i.test(reg), /SECURITY DEFINER/i.test(ris)],
  );
  c(
    "segna_fatto: SECURITY INVOKER (lavora con la RLS dell'utente) e auth.uid() esplicito nel WHERE",
    [true, false, true],
    [
      /SECURITY INVOKER/i.test(fat),
      /SECURITY DEFINER/i.test(fat),
      /WHERE[^;]*\buser_id = auth\.uid\(\)/i.test(fat),
    ],
  );

  /* ── [R2] i permessi, uno per uno ─────────────────────────────────────── */
  /** Le istruzioni GRANT/REVOKE che nominano una funzione (le firme sono su una riga sola). */
  const permessi = (nome) =>
    [
      ...sql.matchAll(
        new RegExp(`\\b(GRANT|REVOKE)\\b[^;]*?FUNCTION public\\.${nome}\\([^;]*;`, "gi"),
      ),
    ].map((m) => m[0].replace(/\s+/g, " "));
  for (const nome of ["whatsapp_registra_entrata", "whatsapp_segna_risposto"]) {
    const p = permessi(nome);
    const grant = p.filter((x) => /^GRANT/i.test(x));
    c(
      `${nome}: REVOKE ALL … FROM PUBLIC, anon, authenticated`,
      true,
      p.some((x) =>
        new RegExp(
          `^REVOKE ALL ON FUNCTION public\\.${nome}\\(${firme[nome]}\\) FROM PUBLIC, anon, authenticated;$`,
          "i",
        ).test(x),
      ),
    );
    c(
      `${nome}: GRANT EXECUTE solo a service_role`,
      [1, true],
      [
        grant.length,
        grant.every((x) =>
          new RegExp(
            `^GRANT EXECUTE ON FUNCTION public\\.${nome}\\(${firme[nome]}\\) TO service_role;$`,
            "i",
          ).test(x),
        ),
      ],
    );
    c(
      `${nome}: «authenticated» NON compare in nessun GRANT (R2: qualunque utente loggato non può chiamarla)`,
      false,
      grant.some((x) =>
        /authenticated|anon|PUBLIC/i.test(x.replace(/^GRANT EXECUTE ON FUNCTION[^)]*\)/i, "")),
      ),
    );
  }
  {
    const p = permessi("whatsapp_segna_fatto");
    c(
      "segna_fatto: GRANT EXECUTE a authenticated; REVOKE da PUBLIC, anon",
      [true, true],
      [
        p.some((x) =>
          /^GRANT EXECUTE ON FUNCTION public\.whatsapp_segna_fatto\(text\) TO authenticated;$/i.test(
            x,
          ),
        ),
        p.some((x) =>
          /^REVOKE ALL ON FUNCTION public\.whatsapp_segna_fatto\(text\) FROM PUBLIC, anon;$/i.test(
            x,
          ),
        ),
      ],
    );
    c(
      "…e non a anon né a PUBLIC",
      false,
      p.some((x) => /^GRANT[^;]* TO [^;]*\b(anon|PUBLIC)\b/i.test(x)),
    );
  }

  /* ── registra_entrata: +1 atomico, due formati, orologio del database ──── */
  c(
    "registra_entrata: unread_count + 1 nel ramo UPDATE e nel ON CONFLICT DO UPDATE",
    2,
    (reg.match(/unread_count\s*=\s*(?:\w+\.)?unread_count\s*\+\s*1/gi) ?? []).length,
  );
  c(
    "…riconosce i due formati del numero (col «+» e senza)",
    [true, true],
    [/'\+'\s*\|\|\s*v_tel/.test(reg), /phone_e164 IN \(/i.test(reg)],
  );
  c(
    "…se la riga non c'è: INSERT … ON CONFLICT (user_id, phone_e164) DO UPDATE",
    true,
    /INSERT INTO public\.whatsapp_contacts[\s\S]*ON CONFLICT \(user_id, phone_e164\) DO UPDATE/i.test(
      reg,
    ),
  );
  c(
    "…il nuovo contatto parte da unread_count = 1, col «+»",
    true,
    /VALUES\s*\(\s*p_user_id, '\+' \|\| v_tel, p_lead_id, p_nome, 1,/i.test(reg),
  );
  c(
    "R3 · last_message_at e ultimo_in_entrata_il = now() del DATABASE (v_ora), nell'UPDATE e nel ON CONFLICT",
    [true, 2, 2],
    [
      /v_ora\s+timestamptz\s*:=\s*coalesce\(now\(\), p_il\)/i.test(reg),
      (reg.match(/last_message_at\s*=\s*v_ora/gi) ?? []).length,
      (reg.match(/ultimo_in_entrata_il\s*=\s*v_ora/gi) ?? []).length,
    ],
  );
  c(
    "R3 · …niente greatest( nella funzione (e quindi su quelle due colonne)",
    false,
    /greatest\s*\(/i.test(reg),
  );
  c(
    "R3 · …p_il compare solo come ripiego di now(): nessun confronto lo usa",
    false,
    /\bp_il\b/.test(
      reg.replace(/coalesce\(now\(\), p_il\)/gi, "").replace(/p_il timestamptz/i, ""),
    ),
  );
  c(
    "…lead_id e display_name: il valore vecchio vince (coalesce); subscriber_id: il nuovo vince",
    [true, true, true],
    [
      /lead_id\s*=\s*coalesce\((?:\w+\.)?lead_id, (?:excluded\.lead_id|p_lead_id)\)/i.test(reg),
      /display_name\s*=\s*coalesce\((?:\w+\.)?display_name, (?:excluded\.display_name|p_nome)\)/i.test(
        reg,
      ),
      /subscriber_id\s*=\s*coalesce\((?:excluded\.subscriber_id|p_subscriber_id), (?:\w+\.)?subscriber_id\)/i.test(
        reg,
      ),
    ],
  );
  c(
    "…l'anteprima si sovrascrive sempre (l'ultimo messaggio vince)",
    true,
    /ultimo_in_entrata_anteprima\s*=\s*(?:excluded\.ultimo_in_entrata_anteprima|p_anteprima)/i.test(
      reg,
    ),
  );
  c(
    "…lavora solo sulle righe dell'utente (user_id = p_user_id nell'UPDATE)",
    true,
    /user_id = p_user_id/.test(reg),
  );

  /* ── segna_risposto / segna_fatto: ora del database ───────────────────── */
  for (const [nome, f] of [
    ["segna_risposto", ris],
    ["segna_fatto", fat],
  ]) {
    c(
      `${nome}: risposto_il = greatest(now(), ultimo_in_entrata_il), ora del database`,
      true,
      /risposto_il\s*=\s*greatest\(now\(\), ultimo_in_entrata_il\)/i.test(f),
    );
    c(
      `${nome}: riconosce i due formati del numero, restituisce boolean`,
      [true, true],
      [/'\+'\s*\|\|\s*v_tel/.test(f) && /phone_e164 IN \(/i.test(f), /RETURNS boolean/i.test(f)],
    );
  }
  c(
    "segna_risposto: solo l'utente passato (user_id = p_user_id)",
    true,
    /user_id = p_user_id/.test(ris),
  );

  /* ── [R7] la funzione della pausa: dentro il DO, uguale a M1 salvo la pausa ─ */
  const iDo = sql.search(/\bDO\s+\$(\w*)\$/i);
  const tagDo = (sql.match(/\bDO\s+\$(\w*)\$/i) ?? [])[1];
  const blocco = iDo < 0 ? "" : sql.slice(iDo, sql.indexOf(`$${tagDo}$;`, iDo + 8) + 1);
  c("un solo blocco DO", 1, (sql.match(/\bDO\s+\$/gi) ?? []).length);
  c(
    "il DO controlla che manychat_prenota_porta(uuid, jsonb) esista (se M1 non c'è, niente funzione orfana)",
    true,
    /IF to_regprocedure\('public\.manychat_prenota_porta\(uuid, jsonb\)'\) IS NOT NULL THEN/i.test(
      blocco,
    ),
  );
  const fuoriDo = blocco ? sql.replace(blocco, " ") : sql;
  c(
    "…la funzione si crea DENTRO il DO (EXECUTE) e non fuori",
    [true, false],
    [
      /EXECUTE\s+\$f\$\s*CREATE OR REPLACE FUNCTION public\.manychat_prenota_porta/i.test(blocco),
      /manychat_prenota_porta/i.test(fuoriDo),
    ],
  );
  c(
    "…REVOKE e GRANT di quella funzione stanno DENTRO il DO (un REVOKE su funzione assente dà errore)",
    [true, true, false],
    [
      /REVOKE ALL ON FUNCTION public\.manychat_prenota_porta\(uuid, jsonb\) FROM PUBLIC, anon, authenticated;/i.test(
        blocco,
      ),
      /GRANT EXECUTE ON FUNCTION public\.manychat_prenota_porta\(uuid, jsonb\) TO service_role;/i.test(
        blocco,
      ),
      /(REVOKE|GRANT)[^;]*manychat_prenota_porta/i.test(fuoriDo),
    ],
  );
  const dentroF = (blocco.match(/\$f\$([\s\S]*?)\$f\$/) ?? [])[1] ?? "";
  const nuova = dentroF.slice(
    dentroF.indexOf("CREATE OR REPLACE FUNCTION public.manychat_prenota_porta"),
  );
  const vecchia = corpoFunzione(m1, "manychat_prenota_porta").replace(
    /^FUNCTION/,
    "CREATE OR REPLACE FUNCTION",
  );

  c(
    "la nuova funzione è stata estratta (testo non vuoto)",
    true,
    nuova.length > 500 && vecchia.length > 500,
  );
  c(
    "firma, SECURITY DEFINER e search_path = public come in M1",
    [true, true, true],
    [
      /CREATE OR REPLACE FUNCTION public\.manychat_prenota_porta\(p_user_id uuid, p jsonb\)\s*RETURNS jsonb/i.test(
        nuova,
      ),
      /SECURITY DEFINER/i.test(nuova),
      /SET search_path = public AS/i.test(nuova),
    ],
  );
  /** Vero se i due testi sono uguali salvo l'impaginazione e la dichiarazione della pausa. */
  const ugualeAM1 = (n, v) => senzaPausa(n) === senzaPausa(v);
  c(
    "R7 · il corpo, normalizzato, è IDENTICO a quello di M1 tranne la dichiarazione della pausa",
    true,
    ugualeAM1(nuova, vecchia),
  );
  c(
    "…il confronto SA vedere una riga cambiata: FOR UPDATE → FOR SHARE",
    false,
    ugualeAM1(nuova.replace("FOR UPDATE", "FOR SHARE"), vecchia),
  );
  c(
    "…e un STOP tolto",
    false,
    ugualeAM1(nuova.replace(/non_scrivere_dal IS NOT NULL/, "TRUE"), vecchia),
  );
  c(
    "…e la pausa che vale 120 per tutti (la differenza c'è davvero, nel solo blocco della pausa)",
    [false, true],
    [norm(nuova) === norm(vecchia), ugualeAM1(nuova, vecchia)],
  );
  c(
    "…una riga in più fuori dal blocco della pausa → il confronto la vede",
    false,
    ugualeAM1(
      nuova.replace(
        "RETURN jsonb_build_object('id', v_id);",
        "RETURN jsonb_build_object('id', v_id, 'x', 1);",
      ),
      vecchia,
    ),
  );
  const dichiara = (nuova.match(DICHIARA_PAUSA) ?? [""])[0];
  c(
    "la pausa vale 2 s se tipo = 'chat' E flow_ns è vuoto, 120 s in tutti gli altri casi",
    true,
    /CASE\s+WHEN\s+p->>'tipo'\s*=\s*'chat'\s+AND\s+coalesce\(p->>'flow_ns', ''\)\s*=\s*''\s+THEN\s+2\s+ELSE\s+120\s+END/i.test(
      dichiara,
    ),
  );
  const pos = (re, t = nuova) => {
    const m = re.exec(t);
    return m ? m.index : -1;
  };
  const passi = {
    dichiara: pos(DICHIARA_PAUSA),
    coda: pos(/FROM public\.manychat_giro\s+WHERE id = 1\s+FOR UPDATE/i),
    scaduti: pos(/SET stato = 'incerto'/i),
    stop: pos(/non_scrivere_dal IS NOT NULL/i),
    pausa: pos(/'pausa_contatto'/i),
    inserisce: pos(/INSERT INTO public\.manychat_invii/i),
  };
  c(
    "ordine dei passi 1-5: FOR UPDATE → incerto → STOP → pausa → inserimento (STOP PRIMA della pausa)",
    true,
    Object.values(passi).every((n) => n >= 0) &&
      passi.dichiara < passi.coda &&
      passi.coda < passi.scaduti &&
      passi.scaduti < passi.stop &&
      passi.stop < passi.pausa &&
      passi.pausa < passi.inserisce,
  );
  c(
    "la pausa guarda ancora prenotato, inviato, incerto (mai saltato né fallito)",
    [true, false],
    [
      /stato IN \('prenotato', 'inviato', 'incerto'\)/i.test(nuova),
      /saltato|fallito/i.test(nuova.slice(passi.stop, passi.pausa)),
    ],
  );

  /* ── il MODELLO della prenotazione (stesso ordine dell'SQL, D11 [R7]) ──── */
  const ADESSO = Date.parse("2026-10-28T14:00:00Z");
  /** Il modello: ripete `manychat_prenota_porta` con la pausa di D11. */
  const prenota = (db, userId, p, adesso = ADESSO) => {
    const tel = String(p.telefono ?? "").replace(/\D/g, "");
    if (!userId || !tel) return { motivo: "dati_mancanti" };
    if (!db.giro) return { motivo: "manca_riga_giro" };
    for (const i of db.invii)
      if (i.user_id === userId && i.stato === "prenotato" && i.prenotato_il < adesso - 600e3)
        i.stato = "incerto";
    if (
      db.contatti.some(
        (x) =>
          x.user_id === userId &&
          x.non_scrivere_dal &&
          (x.phone_e164 === `+${tel}` || x.phone_e164.replace(/^\++/, "") === tel),
      )
    )
      return { motivo: "stop" };
    const pausaS = p.tipo === "chat" && (p.flow_ns ?? "") === "" ? 2 : 120;
    if (
      db.invii.some(
        (i) =>
          i.user_id === userId &&
          i.telefono === tel &&
          ["prenotato", "inviato", "incerto"].includes(i.stato) &&
          (i.inviato_il ?? i.prenotato_il) > adesso - pausaS * 1000,
      )
    )
      return { motivo: "pausa_contatto" };
    const chiave = p.chiave || null;
    if (chiave && db.invii.some((i) => i.chiave === chiave)) return { motivo: "gia_preso" };
    const id = `inv-${db.invii.length + 1}`;
    db.invii.push({
      id,
      user_id: userId,
      tipo: p.tipo,
      chiave,
      telefono: tel,
      stato: "prenotato",
      prenotato_il: adesso,
    });
    return { id };
  };
  const nuovoDb = (o = {}) => ({ giro: true, invii: [], contatti: [], ...o });
  const TEL = "393331234567";
  const dopo = (s) => ADESSO + s * 1000;
  const conInvio = () => {
    const db = nuovoDb();
    prenota(db, "u", { tipo: "conferma", telefono: TEL, flow_ns: "f1", chiave: "c|1" });
    return db;
  };

  let db = conInvio();
  c(
    "modello · testo libero «chat» 1 s dopo un invio → pausa_contatto",
    "pausa_contatto",
    prenota(db, "u", { tipo: "chat", telefono: TEL }, dopo(1)).motivo,
  );
  c(
    "modello · testo libero «chat» 3 s dopo → prenotato",
    true,
    !!prenota(db, "u", { tipo: "chat", telefono: TEL }, dopo(3)).id,
  );
  db = nuovoDb();
  const a1 = prenota(db, "u", { tipo: "chat", telefono: TEL }, ADESSO);
  const a2 = prenota(db, "u", { tipo: "chat", telefono: TEL }, dopo(10));
  c(
    "modello · due testi liberi a 10 s → entrambi prenotati (criterio 4)",
    [true, true],
    [!!a1.id, !!a2.id],
  );
  db = conInvio();
  c(
    "modello · modello (flusso pieno) 10 s dopo un invio → pausa_contatto",
    "pausa_contatto",
    prenota(db, "u", { tipo: "chat", telefono: TEL, flow_ns: "f2" }, dopo(10)).motivo,
  );
  db = conInvio();
  c(
    "modello · testo libero con flusso pieno 10 s dopo → pausa_contatto",
    "pausa_contatto",
    prenota(db, "u", { tipo: "chat", telefono: TEL, flow_ns: "f2" }, dopo(10)).motivo,
  );
  c(
    "modello · tipo diverso da «chat» e flusso vuoto, 10 s dopo → pausa_contatto",
    "pausa_contatto",
    prenota(db, "u", { tipo: "ricontatto", telefono: TEL }, dopo(10)).motivo,
  );
  c(
    "modello · modello 121 s dopo → si può (la pausa dei modelli è ancora 120 s)",
    true,
    !!prenota(db, "u", { tipo: "chat", telefono: TEL, flow_ns: "f2" }, dopo(121)).id,
  );
  db = nuovoDb({ contatti: [{ user_id: "u", phone_e164: `+${TEL}`, non_scrivere_dal: "x" }] });
  c(
    "modello · STOP con testo libero → stop (prima della pausa, vale sempre)",
    "stop",
    prenota(db, "u", { tipo: "chat", telefono: TEL }, dopo(60)).motivo,
  );
  db = nuovoDb({ contatti: [{ user_id: "u", phone_e164: TEL, non_scrivere_dal: "x" }] });
  db.invii.push({ user_id: "u", telefono: TEL, stato: "inviato", prenotato_il: ADESSO });
  c(
    "modello · STOP su riga senza «+» dopo un invio recente → stop, non pausa",
    "stop",
    prenota(db, "u", { tipo: "chat", telefono: TEL }, dopo(1)).motivo,
  );

  /* ── il MODELLO dell'entrata (D2 [R3]: un solo orologio, quello del DB) ── */
  /** `registra_entrata`: +1, formato del numero, `now()` del DATABASE (il Worker passa `pIl` e NON conta). */
  const registra = (db2, userId, phone, dbOra, pIl) => {
    const tel = String(phone).replace(/\D/g, "");
    const righe = db2.filter(
      (r) => r.user_id === userId && (r.phone_e164 === `+${tel}` || r.phone_e164 === tel),
    );
    const riga = righe.sort(
      (x, y) => (y.phone_e164 === `+${tel}`) - (x.phone_e164 === `+${tel}`),
    )[0];
    const ora = dbOra ?? pIl; // coalesce(now(), p_il): p_il è solo un ripiego
    if (riga) {
      riga.unread_count += 1;
      riga.last_message_at = ora;
      riga.ultimo_in_entrata_il = ora;
      return riga;
    }
    const nuova2 = {
      user_id: userId,
      phone_e164: `+${tel}`,
      unread_count: 1,
      last_message_at: ora,
      ultimo_in_entrata_il: ora,
      risposto_il: null,
    };
    db2.push(nuova2);
    return nuova2;
  };
  const segnaRisposto = (db2, userId, phone, dbOra) => {
    const tel = String(phone).replace(/\D/g, "");
    const righe = db2.filter(
      (r) => r.user_id === userId && (r.phone_e164 === `+${tel}` || r.phone_e164 === tel),
    );
    for (const r of righe) r.risposto_il = Math.max(dbOra, r.ultimo_in_entrata_il ?? -Infinity);
    return righe.length > 0;
  };
  const daRispondere = (r) =>
    r.ultimo_in_entrata_il != null &&
    (r.risposto_il == null || r.ultimo_in_entrata_il > r.risposto_il);

  const T = Date.parse("2026-10-28T15:00:00Z");
  let rub = [];
  registra(rub, "u", TEL, T, T);
  registra(rub, "u", TEL, T + 1000, T + 1000);
  registra(rub, "u", TEL, T + 2000, T + 2000);
  c(
    "entrata · tre messaggi → unread_count 3 (non 1), una riga sola",
    [3, 1],
    [rub[0].unread_count, rub.length],
  );
  c(
    "entrata · un numero nuovo nasce con unread_count 1 e «Da rispondere»",
    [1, true],
    [
      (() => {
        const x = [];
        registra(x, "u", TEL, T, T);
        return x[0].unread_count;
      })(),
      daRispondere(rub[0]),
    ],
  );
  rub = [
    {
      user_id: "u",
      phone_e164: TEL,
      unread_count: 2,
      last_message_at: T,
      ultimo_in_entrata_il: T,
      risposto_il: null,
    },
  ];
  registra(rub, "u", `+${TEL}`, T + 1000, T + 1000);
  c(
    "entrata · riga vecchia senza «+», numero scritto col «+» → stessa riga, +1, niente doppione",
    [1, 3],
    [rub.length, rub[0].unread_count],
  );
  rub = [];
  registra(rub, "u", TEL, T, T);
  segnaRisposto(rub, "u", TEL, T + 100_000);
  c("entrata · dopo la risposta il cliente esce da «Da rispondere»", false, daRispondere(rub[0]));
  /*  R3: la risposta è a `t`; il cliente riscrive a t+1 s sull'orologio del DB, ma il Worker è
   *  indietro di 5 s (pIl = t − 4 s). Conta il DB: rientra. */
  const t = T + 100_000;
  registra(rub, "u", TEL, t + 1000, t - 4000);
  c(
    "R3 · risposta a t, cliente riscrive a t+1 s con il Worker indietro di 5 s → RIENTRA",
    true,
    daRispondere(rub[0]),
  );
  c(
    "R3 · …ultimo_in_entrata_il è l'orologio del DB e non quello del Worker",
    [t + 1000, t + 1000],
    [rub[0].ultimo_in_entrata_il, rub[0].last_message_at],
  );
  {
    /*  Il controllo: con l'orologio del Worker la chat si perderebbe (il difetto che R3 toglie). */
    const sbagliato = [
      {
        user_id: "u",
        phone_e164: `+${TEL}`,
        unread_count: 1,
        ultimo_in_entrata_il: T,
        risposto_il: t,
      },
    ];
    sbagliato[0].ultimo_in_entrata_il = t - 4000;
    c(
      "R3 · …(controllo: con l'ora del Worker non rientrerebbe: è proprio il difetto evitato)",
      false,
      daRispondere(sbagliato[0]),
    );
  }
  rub = [
    {
      user_id: "u",
      phone_e164: `+${TEL}`,
      unread_count: 1,
      ultimo_in_entrata_il: T,
      risposto_il: null,
    },
  ];
  segnaRisposto(rub, "u", TEL, T - 5000);
  c(
    "segna_risposto · con l'orologio del DB indietro non scrive un'ora prima del messaggio (greatest)",
    true,
    rub[0].risposto_il === T && !daRispondere(rub[0]),
  );
  c(
    "segna_risposto · numero sconosciuto → falso, nessuna riga creata",
    [false, 1],
    [segnaRisposto(rub, "u", "393339999999", T), rub.length],
  );
  rub = [
    {
      user_id: "altro",
      phone_e164: `+${TEL}`,
      unread_count: 1,
      ultimo_in_entrata_il: T,
      risposto_il: null,
    },
  ];
  c(
    "segna_risposto · un'altra installazione non si tocca",
    [false, true],
    [segnaRisposto(rub, "u", TEL, T + 1), daRispondere(rub[0])],
  );
}
