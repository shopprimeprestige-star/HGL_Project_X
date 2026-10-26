/** ── PROVE: LA MIGRAZIONE S2 (TESTO) ─────────────────────────────────────────
 *
 *  Commessa 2026-10-25 (Sheets e sequenze WhatsApp), compito G. Qui NON gira un
 *  Postgres: si legge il testo di `20261025120100_manychat_sequenze.sql`. Il
 *  comportamento vero (tetti, riserva, ritmo, CHECK due volte, lock_timeout)
 *  è stato collaudato su un Postgres vero (pglite) e l'uscita è in LAVAGNA; il
 *  modello della prenotazione che prova il TypeScript è in `giro.mjs`.
 *  Dati inventati: nessun numero vero.
 *
 *  `mod`: i moduli impacchettati. `aiuti`: `{ c, gruppo, radice }`. */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const senzaCommenti = (sql) =>
  sql
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/--[^\n]*/g, "")
    .replace(/[ \t]+\n/g, "\n");
const corpoFunzione = (sql, nome) => {
  const da = sql.indexOf(`FUNCTION public.${nome}(`);
  if (da < 0) return "";
  const fine = sql.indexOf("$$;", da);
  return sql.slice(da, fine < 0 ? undefined : fine + 3);
};

export async function proveSequenzeMigrazione(_mod, { c, gruppo, radice }) {
  gruppo("MANYCHAT · S2, LA MIGRAZIONE DELLE SEQUENZE (TESTO)");
  const percorso = join(radice, "supabase/migrations/20261025120100_manychat_sequenze.sql");
  c("S2 esiste col nome del piano", true, existsSync(percorso));
  if (!existsSync(percorso)) return;
  const grezzo = readFileSync(percorso, "utf8");
  const sql = senzaCommenti(grezzo);
  const alto = sql.toUpperCase();

  /* ── le colonne ─────────────────────────────────────────────────────── */
  const colonne = [...sql.matchAll(/ADD COLUMN IF NOT EXISTS\s+(\w+)\s+([^,;\n]+)/gi)].map(
    (m) => m[1],
  );
  c(
    "cinque colonne, tutte con ADD COLUMN IF NOT EXISTS, coi nomi che legge il riquadro",
    ["lead_nuovo", "giorno_meet", "lead_nuovo_dal", "stati", "indirizzo_sede"],
    colonne,
  );
  c(
    "…interruttori spenti e stati vuoti di serie",
    [true, true, true],
    [
      /lead_nuovo\s+boolean\s+NOT NULL DEFAULT false/i.test(sql),
      /giorno_meet\s+boolean\s+NOT NULL DEFAULT false/i.test(sql),
      /stati\s+jsonb\s+NOT NULL DEFAULT '\{\}'::jsonb/i.test(sql),
    ],
  );

  /* ── il CHECK su `tipo`: l'unica eccezione al «niente DROP» ─────────── */
  c(
    "un solo DROP eseguibile (il vincolo), niente DELETE, TRUNCATE, DROP TABLE o DROP COLUMN",
    [1, false, false, false, false],
    [
      (alto.match(/\bDROP\b/g) ?? []).length,
      /\bDELETE\b/.test(alto),
      /\bTRUNCATE\b/.test(alto),
      /DROP TABLE|DROP FUNCTION/.test(alto),
      /DROP COLUMN/.test(alto),
    ],
  );
  const alter = [
    ...sql.matchAll(
      /ALTER TABLE public\.manychat_invii[\s\S]*?(?=['"]?\s*,?\s*\n\s*(?:END|ELSE|\)))/gi,
    ),
  ];
  const tipi13 = [
    "promemoria",
    "ricontatto",
    "conferma",
    "chat",
    "webinar",
    "prova",
    "primo_contatto",
    "richiamo_24h",
    "meet_oggi",
    "meet_adesso",
    "promemoria_chiamata",
    "promemoria_sede",
    "meet_domani",
  ];
  c(
    "il CHECK allargato ha i 6 tipi di M1 più i 7 nuovi (compreso meet_domani, 24 ore prima)",
    true,
    tipi13.every((t) => sql.includes(`'${t}'`) || sql.includes(`''${t}''`)),
  );
  c(
    "DROP e ADD CONSTRAINT stanno nello STESSO comando ALTER TABLE (atomico)",
    true,
    /ALTER TABLE public\.manychat_invii DROP CONSTRAINT %I, ADD CONSTRAINT manychat_invii_tipo_check CHECK/.test(
      sql,
    ),
  );
  void alter;
  const blocco = sql.slice(sql.indexOf("DO $$"), sql.indexOf("END $$;", sql.indexOf("DO $$")));
  c(
    "idempotenza sulla DEFINIZIONE (pg_get_constraintdef contiene 'meet_domani', l'ultimo arrivato), non sul nome",
    [true, true, false],
    [
      /pg_get_constraintdef/.test(blocco),
      /LIKE '%''meet_domani''%'/.test(blocco),
      /LIKE '%''promemoria_sede''%'/.test(blocco),
    ],
  );
  c(
    "SET LOCAL lock_timeout = '5s' PRIMA dell'ALTER",
    true,
    blocco.indexOf("SET LOCAL lock_timeout = '5s'") > 0 &&
      blocco.indexOf("SET LOCAL lock_timeout = '5s'") < blocco.indexOf("ALTER TABLE"),
  );
  c(
    "SET lock_timeout = '5s' in testa al file (copre anche l'ALTER delle colonne) e RESET in fondo",
    true,
    sql.indexOf("SET lock_timeout = '5s';") > 0 &&
      sql.indexOf("SET lock_timeout = '5s';") < sql.indexOf("ADD COLUMN") &&
      sql.indexOf("RESET lock_timeout;") > sql.indexOf("manychat_controlli_unisci"),
  );
  c(
    "«come si annulla» col CHECK di M1 testuale, nel commento",
    [true, true],
    [
      /COME SI ANNULLA/.test(grezzo),
      grezzo.includes(
        "CHECK (tipo IN ('promemoria', 'ricontatto', 'conferma', 'chat', 'webinar', 'prova'))",
      ),
    ],
  );
  c(
    "«come si annulla» avverte delle righe meet_domani (il vincolo di M1 non si rimette con righe dei tipi nuovi)",
    true,
    /COME SI ANNULLA[\s\S]*?meet_domani[\s\S]*?CHECK \(tipo IN \('promemoria', 'ricontatto', 'conferma'/.test(
      grezzo,
    ),
  );
  c(
    "…e la versione di M2 di manychat_prenota_giro è nel commento (per tornare indietro)",
    true,
    /--\s+CREATE OR REPLACE FUNCTION public\.manychat_prenota_giro\([\s\S]*v_tetto_tot constant int := 40/.test(
      grezzo,
    ),
  );

  /* ── la prenotazione ─────────────────────────────────────────────────── */
  const pr = corpoFunzione(sql, "manychat_prenota_giro");
  c(
    "stessa firma di M2 (uuid, jsonb, jsonb, integer), SECURITY DEFINER, search_path fissato",
    [true, true],
    [
      /p_user_id uuid,\s+p jsonb,\s+p_tetti jsonb,\s+p_intervallo_min integer/.test(pr),
      /SECURITY DEFINER SET search_path = public/.test(pr),
    ],
  );
  c(
    "i tipi ammessi sono i nove del giro",
    true,
    [
      "promemoria",
      "ricontatto",
      "primo_contatto",
      "richiamo_24h",
      "meet_oggi",
      "meet_domani",
      "meet_adesso",
      "promemoria_chiamata",
      "promemoria_sede",
    ].every((t) => pr.includes(`'${t}'`)) && !pr.includes("'conferma'"),
  );
  c(
    "meet_domani è nell'elenco dei tipi validi E in quello dei tetti (se manca in uno, il giro lo rifiuta o non lo conta)",
    2,
    (pr.match(/'meet_domani'/g) ?? []).length,
  );
  c(
    "…e non è fra quelli della riserva né del ritmo (come meet_oggi)",
    [false, false],
    [
      /IN \('primo_contatto', 'richiamo_24h', 'ricontatto'[^)]*meet_domani/.test(pr),
      /IN \('ricontatto', 'richiamo_24h'[^)]*meet_domani/.test(pr),
    ],
  );
  c(
    "costanti: tetto lead nuovi 30, totale 100, riserva 30",
    [true, true, true],
    [
      /v_tetto_ln\s+constant int := 30/.test(pr),
      /v_tetto_tot\s+constant int := 100/.test(pr),
      /v_riserva\s+constant int := 30/.test(pr),
    ],
  );
  c(
    "primo contatto, richiamo e ricontatto contano contro il totale meno la riserva",
    true,
    /IN \('primo_contatto', 'richiamo_24h', 'ricontatto'\) THEN\s+v_limite := GREATEST\(v_max_tot - v_riserva, 0\)/.test(
      pr,
    ),
  );
  c(
    "il riquadro può solo abbassare, anche i lead nuovi (LEAST con la costante)",
    true,
    /LEAST\(v_tetto_ln, \(p_tetti->>'leadNuovi'\)::int\)/.test(pr),
  );
  const dentro = (re) => {
    const m = re.exec(pr);
    return m ? m.index : -1;
  };
  const passi = {
    fila: dentro(/FROM public\.manychat_giro WHERE id = 1 FOR UPDATE/i),
    incerto: dentro(/SET stato = 'incerto'/i),
    tetti: dentro(/'tetto_totale'/),
    stop: dentro(/non_scrivere_dal IS NOT NULL/i),
    pausa: dentro(/'pausa_contatto'/),
    ritmo: dentro(/'ritmo'/),
    inserisce: dentro(/INSERT INTO public\.manychat_invii/i),
    posto: dentro(/SET prossimo_ricontatto_dopo = now\(\)/i),
  };
  c(
    "stesso ordine dei passi di M2: fila, incerti, tetti, STOP, pausa, ritmo (lettura), inserimento, posto del ritmo",
    true,
    Object.values(passi).every((v) => v > 0) &&
      passi.fila < passi.incerto &&
      passi.incerto < passi.tetti &&
      passi.tetti < passi.stop &&
      passi.stop < passi.pausa &&
      passi.pausa < passi.ritmo &&
      passi.ritmo < passi.inserisce &&
      passi.inserisce < passi.posto,
  );
  c(
    "il ritmo si legge E si scrive solo per ricontatto e richiamo_24h; nessun GREATEST sul ritmo",
    [true, true, false],
    [
      /v_tipo IN \('ricontatto', 'richiamo_24h'\)\s+AND coalesce\(v_ritmo/.test(pr),
      /IF v_tipo IN \('ricontatto', 'richiamo_24h'\) THEN\s+v_i := [\s\S]*?prossimo_ricontatto_dopo = now\(\)/.test(
        pr,
      ),
      /GREATEST\(coalesce\(prossimo_ricontatto_dopo/.test(pr),
    ],
  );
  c(
    "gia_preso viene prima del posto del ritmo (non lo consuma)",
    true,
    dentro(/'gia_preso'/) > passi.inserisce && dentro(/'gia_preso'/) < passi.posto,
  );
  c("il motivo nuovo dei lead nuovi", true, /'tetto_lead_nuovi'/.test(pr));

  /* ── l'unione di `controlli` ────────────────────────────────────────── */
  const un = corpoFunzione(sql, "manychat_controlli_unisci");
  c(
    "manychat_controlli_unisci: un UPDATE solo, `controlli || p_patch`, sulla riga 1 e sull'utente",
    [1, true, true],
    [
      (un.match(/\bUPDATE\b/g) ?? []).length,
      /\|\| p_patch/.test(un),
      /WHERE id = 1 AND user_id = p_user_id/.test(un),
    ],
  );
  c("…accetta solo un oggetto json", true, /jsonb_typeof\(p_patch\) <> 'object'/.test(un));

  /* ── chiusure ───────────────────────────────────────────────────────── */
  for (const [nome, args] of [
    ["manychat_prenota_giro", "uuid, jsonb, jsonb, integer"],
    ["manychat_controlli_unisci", "uuid, jsonb"],
  ])
    c(
      `${nome}: revocata a PUBLIC, anon, authenticated; solo service_role`,
      [true, true],
      [
        new RegExp(
          `REVOKE ALL ON FUNCTION public\\.${nome}\\(${args}\\) FROM PUBLIC, anon, authenticated`,
          "i",
        ).test(sql),
        new RegExp(
          `GRANT EXECUTE ON FUNCTION public\\.${nome}\\(${args}\\) TO service_role`,
          "i",
        ).test(sql),
      ],
    );
  c("NOTIFY pgrst per ricaricare lo schema", true, /NOTIFY pgrst, 'reload schema'/i.test(sql));
  c("i delimitatori $$ sono in numero pari", 0, (sql.match(/\$\$/g) ?? []).length % 2);
  c(
    "nessun indirizzo né chiave scritti a mano",
    false,
    /https?:\/\/|eyJ[A-Za-z0-9_-]{20,}/.test(grezzo),
  );
}
