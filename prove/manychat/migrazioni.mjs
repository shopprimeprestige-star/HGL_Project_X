/** ── PROVE: LE MIGRAZIONI (LETTURA DEL TESTO) ───────────────────────────────────────────
 *
 *  Commessa 2026-10-23 (ManyChat), compito U2 per M1 (poi il 3 aggiunge M2 e M3).
 *  Qui NON gira un Postgres: si legge il testo dei file SQL e si controlla che
 *  dica quello che il piano vuole (solo aggiunte, tabelle chiuse, le funzioni
 *  chiuse a tutti tranne al server, i controlli nell'ordine giusto). In più, un
 *  piccolo MODELLO della prenotazione della porta che ripete lo stesso ordine
 *  passo per passo, per mostrare i casi (STOP nei due formati, pausa che non
 *  conta `saltato`, `gia_preso`). Il modello non sostituisce una prova su un
 *  Postgres vero: il revisore legge anche l'SQL.
 *
 *  ⚠️ Nei controlli i commenti si TOLGONO prima: «come si annulla» contiene
 *   dei DROP, scritti apposta nel commento e mai eseguiti.
 *  Dati inventati: nessun numero vero.
 *
 *  `mod`: i moduli impacchettati. `aiuti`: `{ c, gruppo, radice }`. */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Il SQL senza commenti (`-- …` e il blocco slash-asterisco). Nessuna stringa dei file ha «--» dentro. */
const senzaCommenti = (sql) =>
  sql
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/--[^\n]*/g, "")
    .replace(/[ \t]+\n/g, "\n");

/** Il corpo di una funzione: dal suo CREATE al `$$;` che la chiude. */
const corpoFunzione = (sql, nome) => {
  const da = sql.indexOf(`FUNCTION public.${nome}(`);
  if (da < 0) return "";
  const fine = sql.indexOf("$$;", da);
  return sql.slice(da, fine < 0 ? undefined : fine + 3);
};

export async function proveMigrazioni(mod, { c, gruppo, radice }) {
  gruppo("MANYCHAT · M1, LE MIGRAZIONI (TESTO)");

  const percorso = join(radice, "supabase/migrations/20261023120000_manychat_base.sql");
  c("M1 esiste col nome del piano", true, existsSync(percorso));
  if (!existsSync(percorso)) return;
  const grezzo = readFileSync(percorso, "utf8");
  const sql = senzaCommenti(grezzo);
  const alto = sql.toUpperCase();
  const tabelle = ["manychat_config", "manychat_invii", "manychat_giro"];

  /* ── solo aggiunte ────────────────────────────────────────────────────── */
  c(
    "niente DROP, DELETE, TRUNCATE fuori dai commenti",
    [false, false, false],
    [/\bDROP\b/.test(alto), /\bDELETE\b/.test(alto), /\bTRUNCATE\b/.test(alto)],
  );
  c(
    "…e il «come si annulla» c'è, ma solo nel commento",
    [true, true],
    [/COME SI ANNULLA/i.test(grezzo), /--\s*DROP /.test(grezzo)],
  );
  const alter = [
    ...sql.matchAll(/ALTER TABLE\s+(?:IF EXISTS\s+)?(?:ONLY\s+)?([\w.]+)\s+([A-Z ]+)/gi),
  ];
  c(
    "ALTER TABLE solo su tabelle nuove (RLS) e whatsapp_messages (una colonna)",
    true,
    alter.every(
      ([, t, azione]) =>
        (t.includes("manychat_") && /^ENABLE ROW LEVEL/i.test(azione)) ||
        (t === "public.whatsapp_messages" && /^ADD COLUMN IF NOT EXISTS/i.test(azione)),
    ),
  );
  c(
    "la colonna del canale su whatsapp_messages è facoltativa",
    true,
    /ALTER TABLE public\.whatsapp_messages ADD COLUMN IF NOT EXISTS canale text\s*;/i.test(sql),
  );
  c(
    "UPDATE solo dentro le funzioni (mai sui dati esistenti, a nudo)",
    true,
    [...sql.matchAll(/\bUPDATE\s+public\.(\w+)/gi)].every(([, t]) => t === "manychat_invii"),
  );
  c(
    "nessuna policy: le tabelle non si aprono a nessuno",
    0,
    (sql.match(/CREATE POLICY/gi) ?? []).length,
  );

  /* ── si può applicare due volte ───────────────────────────────────────── */
  c(
    "CREATE TABLE e CREATE INDEX con IF NOT EXISTS; funzioni con OR REPLACE",
    [0, 0, 0],
    [
      (sql.match(/CREATE TABLE(?! IF NOT EXISTS)/gi) ?? []).length,
      (sql.match(/CREATE (?:UNIQUE )?INDEX(?! IF NOT EXISTS)/gi) ?? []).length,
      (sql.match(/CREATE FUNCTION/gi) ?? []).length,
    ],
  );
  c("i delimitatori $$ sono in numero pari", 0, (sql.match(/\$\$/g) ?? []).length % 2);
  c(
    "le parentesi tornano",
    0,
    [...sql].reduce((n, ch) => n + (ch === "(" ? 1 : ch === ")" ? -1 : 0), 0),
  );

  /* ── le tre tabelle, chiuse ───────────────────────────────────────────── */
  for (const t of tabelle) {
    c(
      `${t}: creata, RLS accesa, revocata ad anon e authenticated`,
      [true, true, true],
      [
        new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${t}\\b`, "i").test(sql),
        new RegExp(`ALTER TABLE public\\.${t} ENABLE ROW LEVEL SECURITY`, "i").test(sql),
        new RegExp(`REVOKE ALL ON TABLE public\\.${t} FROM PUBLIC, anon, authenticated`, "i").test(
          sql,
        ),
      ],
    );
    c(
      `${t}: il server (service_role) ci arriva`,
      true,
      new RegExp(`GRANT ALL ON TABLE public\\.${t} TO service_role`, "i").test(sql),
    );
  }

  const tab = (nome) => {
    const da = sql.indexOf(`CREATE TABLE IF NOT EXISTS public.${nome}`);
    return da < 0 ? "" : sql.slice(da, sql.indexOf(");", da) + 2);
  };
  const invii = tab("manychat_invii");
  c(
    "manychat_invii: lead_id facoltativo (il webinar non ha scheda)",
    [true, false],
    [/\blead_id\s+uuid\b/i.test(invii), /\blead_id\s+uuid[^,\n]*NOT NULL/i.test(invii)],
  );
  c(
    "…user_id e telefono obbligatori",
    [true, true],
    [/\buser_id\s+uuid\s+NOT NULL/i.test(invii), /\btelefono\s+text\s+NOT NULL/i.test(invii)],
  );
  c(
    "…i sei tipi e i cinque stati del piano",
    [true, true],
    [
      /promemoria.*ricontatto.*conferma.*chat.*webinar.*prova/is.test(
        invii.match(/tipo[^)]*\)[^)]*\)/i)?.[0] ?? "",
      ),
      /prenotato.*inviato.*fallito.*saltato.*incerto/is.test(
        invii.match(/stato[^)]*\)[^)]*\)/i)?.[0] ?? "",
      ),
    ],
  );
  c(
    "…niente nomi né testi nel registro (solo telefono in cifre)",
    [false, false, false],
    [
      /\b(nome|cognome|testo|body|messaggio|email)\b\s+(text|jsonb)/i.test(invii),
      /\bnome\b/i.test(invii),
      /\btesto\b/i.test(invii),
    ],
  );
  c(
    "…subscriber_id è TESTO (gli id lunghi non perdono cifre): colonna text, mai bigint",
    [true, false, false],
    [/\bsubscriber_id\s+text\b/i.test(invii), /\bbigint\b/i.test(sql), /::\s*bigint/i.test(sql)],
  );
  c(
    "…chiave unica solo dove non è null",
    true,
    /CREATE UNIQUE INDEX IF NOT EXISTS \w+\s+ON public\.manychat_invii\s*\(chiave\)\s*WHERE chiave IS NOT NULL/i.test(
      sql,
    ),
  );
  c(
    "…indici su telefono, subscriber e (utente, tipo)",
    [true, true, true],
    [
      /ON public\.manychat_invii\s*\(telefono, prenotato_il DESC\)/i.test(sql),
      /ON public\.manychat_invii\s*\(subscriber_id, prenotato_il DESC\)/i.test(sql),
      /ON public\.manychat_invii\s*\(user_id, tipo, prenotato_il DESC\)/i.test(sql),
    ],
  );
  const config = tab("manychat_config");
  c(
    "manychat_config: riga unica id = 1, canale «cloud» di serie, interruttori spenti",
    [true, true, true, true],
    [
      /id\s+int\s+PRIMARY KEY\s+CHECK\s*\(id = 1\)/i.test(config),
      /canale\s+text\s+NOT NULL\s+DEFAULT 'cloud'\s+CHECK\s*\(canale IN \('cloud', 'manychat'\)\)/i.test(
        config,
      ),
      /acceso\s+boolean\s+NOT NULL\s+DEFAULT false/i.test(config),
      /promemoria\s+boolean\s+NOT NULL\s+DEFAULT false[\s\S]*ricontatti\s+boolean\s+NOT NULL\s+DEFAULT false/i.test(
        config,
      ),
    ],
  );
  c(
    "…le colonne del piano (tetti, flussi, accensioni, fermo, chi, quando)",
    true,
    [
      "tetti",
      "flussi",
      "prima_accensione",
      "ultima_accensione",
      "fermato_motivo",
      "aggiornato_da",
      "aggiornato_il",
    ].every((k) => new RegExp(`\\b${k}\\b`).test(config)),
  );
  c(
    "…M1 NON inserisce la riga di configurazione (la scrive il titolare con la riga SQL)",
    false,
    /INSERT INTO public\.manychat_config/i.test(sql),
  );
  c(
    "manychat_giro: la riga id = 1 viene inserita, due volte non fa danni",
    true,
    /INSERT INTO public\.manychat_giro\s*\(id\)\s*VALUES\s*\(1\)\s*ON CONFLICT\s*(\(id\)\s*)?DO NOTHING/i.test(
      sql,
    ),
  );
  c(
    "…con lucchetto, ritmo, falliti di fila, stato e ultima risposta",
    true,
    [
      "lucchetto_fino",
      "lucchetto_di",
      "prossimo_ricontatto_dopo",
      "falliti_di_fila",
      "ultimo_giro_il",
      "stato",
      "ultima_risposta_il",
    ].every((k) => new RegExp(`\\b${k}\\b`).test(tab("manychat_giro"))),
  );

  /* ── le funzioni, chiuse ──────────────────────────────────────────────── */
  const firme = {
    manychat_prenota_porta: "uuid, jsonb",
    manychat_esito: "uuid, uuid, jsonb, text",
    programma_hook_cron_attesa: "text, text, text, integer",
  };
  for (const [nome, args] of Object.entries(firme)) {
    const f = corpoFunzione(sql, nome);
    c(
      `${nome}: SECURITY DEFINER, search_path fissato`,
      [true, true],
      [/SECURITY DEFINER/i.test(f), /SET search_path = public/i.test(f)],
    );
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
  }
  c("NOTIFY pgrst per ricaricare lo schema", true, /NOTIFY pgrst, 'reload schema'/i.test(sql));

  /* ── la prenotazione della porta ──────────────────────────────────────── */
  const pr = corpoFunzione(sql, "manychat_prenota_porta");
  const pos = (re) => {
    const m = re.exec(pr);
    return m ? m.index : -1;
  };
  const passi = {
    coda: pos(/FROM public\.manychat_giro\s+WHERE id = 1\s+FOR UPDATE/i),
    scaduti: pos(/SET stato = 'incerto'/i),
    stop: pos(/non_scrivere_dal IS NOT NULL/i),
    pausa: pos(/'pausa_contatto'/i),
    inserisce: pos(/INSERT INTO public\.manychat_invii/i),
  };
  c(
    "la riga del giro è bloccata con FOR UPDATE (mette in fila le prenotazioni)",
    true,
    passi.coda >= 0,
  );
  c(
    "ordine: FOR UPDATE → prenotato>10' diventa incerto → STOP → pausa → inserimento",
    true,
    passi.coda < passi.scaduti &&
      passi.scaduti < passi.stop &&
      passi.stop < passi.pausa &&
      passi.pausa < passi.inserisce,
  );
  c(
    "«prenotato» da più di 10 minuti → incerto (solo dell'utente)",
    true,
    /UPDATE public\.manychat_invii\s+SET stato = 'incerto'[\s\S]*?WHERE user_id = p_user_id\s+AND stato = 'prenotato'\s+AND prenotato_il < now\(\) - interval '10 minutes'/i.test(
      pr,
    ),
  );
  c(
    "STOP col «+» e senza (righe vecchie)",
    [true, true],
    [/c\.phone_e164 = '\+' \|\| v_tel/.test(pr), /ltrim\(c\.phone_e164, '\+'\) = v_tel/.test(pr)],
  );
  c(
    "STOP: solo i contatti dell'utente",
    true,
    /c\.user_id = p_user_id[\s\S]{0,80}non_scrivere_dal IS NOT NULL/i.test(pr),
  );
  const prima = pr.slice(Math.max(0, passi.pausa - 700), passi.pausa);
  c(
    "pausa: conta prenotato, inviato, incerto degli ultimi 120 s",
    [true, true],
    [/stato IN \('prenotato', 'inviato', 'incerto'\)/i.test(prima), /v_pausa_s|120/.test(prima)],
  );
  c("…e mai saltato né fallito", [false, false], [/saltato/i.test(prima), /fallito/i.test(prima)]);
  c(
    "inserimento: ON CONFLICT (chiave) WHERE chiave IS NOT NULL DO NOTHING",
    true,
    /ON CONFLICT \(chiave\) WHERE chiave IS NOT NULL DO NOTHING/i.test(pr),
  );
  c("…e se non inserisce → gia_preso", true, /'gia_preso'/.test(pr));
  c(
    "lead_id facoltativo anche nella funzione",
    true,
    /nullif\(p->>'lead_id', ''\)::uuid/i.test(pr),
  );
  c(
    "tutto con l'utente nel WHERE o nel VALUES (user_id = p_user_id)",
    true,
    (pr.match(/user_id = p_user_id/g) ?? []).length >= 3 && /VALUES\s*\(\s*p_user_id/i.test(pr),
  );
  c(
    "la funzione non chiama nessuno fuori (niente net.http, niente cron)",
    false,
    /net\.http|cron\./i.test(pr),
  );
  c(
    "la risposta della funzione è sempre un oggetto con «id» o «motivo»",
    true,
    (pr.match(/RETURN jsonb_build_object\('(id|motivo)'/g) ?? []).length >= 4,
  );

  const es = corpoFunzione(sql, "manychat_esito");
  c(
    "manychat_esito: aggiorna solo se lo stato è ancora p_da, e solo dell'utente",
    true,
    /WHERE id = p_id\s+AND user_id = p_user_id\s+AND stato = p_da/i.test(es),
  );
  c(
    "…solo i campi del giro di vita (nessun lead, telefono o chiave)",
    false,
    /\b(telefono|chiave|lead_id|tipo|user_id)\s*=\s*CASE/i.test(es),
  );
  c("…restituisce vero se ha toccato una riga", true, /ROW_COUNT[\s\S]*RETURN/i.test(es));

  c(
    "il commento avverte: rilanciare a mano la riga del 22/10 riporta a 5 secondi",
    true,
    /--[^\n]*RIPORTA il lavoro a 5 secondi/.test(grezzo),
  );

  /* ── il cron: solo la riprogrammazione a 45 s ─────────────────────────── */
  const att = corpoFunzione(sql, "programma_hook_cron_attesa");
  c(
    "programma_hook_cron_attesa: legge cron_sito e cron_chiave, senza non programma niente",
    [true, true, true],
    [
      /'cron_sito'/.test(att) && /'cron_chiave'/.test(att),
      /NON programmato/.test(att),
      /RETURN false/.test(att),
    ],
  );
  c(
    "…aggiunge timeout_milliseconds, e la chiave resta quella pubblica (mai la chiave di servizio)",
    [true, false],
    [/timeout_milliseconds := /.test(att), /service_role_key|SERVICE_ROLE/i.test(att)],
  );
  c(
    "…il tempo ha un tetto (non si può scrivere un'attesa assurda)",
    true,
    /GREATEST\(1000, LEAST\(/i.test(att),
  );
  c(
    "la funzione di prima NON si ridefinisce (è nell'altra migrazione)",
    false,
    /FUNCTION public\.programma_hook_cron\s*\(/i.test(sql),
  );
  const chiamate = [
    ...sql.matchAll(/SELECT\s+public\.programma_hook_cron(_attesa)?\s*\(([^)]*)\)/gi),
  ];
  c("una sola riga di cron in M1", 1, chiamate.length);
  c(
    "…è promemoria-whatsapp-2min, ogni 2 minuti, a 45 s",
    [
      "_attesa",
      "'promemoria-whatsapp-2min'",
      "'*/2 * * * *'",
      "'/hooks/promemoria-whatsapp'",
      "45000",
    ],
    chiamate[0] ? [chiamate[0][1], ...chiamate[0][2].split(",").map((x) => x.trim())] : [],
  );
  c("il cron del giro (manychat-giro) NON è in M1: è di M3", false, /manychat-giro/.test(sql));
  c(
    "la riga per tornare indietro c'è, ma solo nel commento",
    [true, false],
    [
      /--[^\n]*programma_hook_cron\('promemoria-whatsapp-2min', '\*\/2 \* \* \* \*', '\/hooks\/promemoria-whatsapp'\)/.test(
        grezzo,
      ),
      /programma_hook_cron\('promemoria/.test(sql),
    ],
  );

  /* ── la riga SQL per canale e flusso (§1c) ────────────────────────────── */
  const pCanale = join(radice, "supabase/MANYCHAT-CANALE.sql");
  c(
    "la riga SQL del titolare (canale e flusso) è a parte, fuori dalle migrazioni",
    true,
    existsSync(pCanale),
  );
  if (existsSync(pCanale)) {
    const gr = readFileSync(pCanale, "utf8");
    const s2 = senzaCommenti(gr);
    c(
      "…mette canale e flusso, senza toccare altro",
      [true, true, true, true],
      [
        /INSERT INTO public\.manychat_config/i.test(s2),
        /'manychat'/.test(s2),
        /consulenza_conferma_presenza/.test(s2),
        /ON CONFLICT \(id\) DO UPDATE/i.test(s2),
      ],
    );
    c(
      "…il flusso nuovo si FONDE con quelli che ci sono (||)",
      true,
      /flussi\s*=\s*public\.manychat_config\.flussi\s*\|\|\s*excluded\.flussi/i.test(s2),
    );
    c(
      "…user_id mai cancellato da un secondo lancio (coalesce)",
      true,
      /user_id\s*=\s*coalesce\(public\.manychat_config\.user_id, excluded\.user_id\)/i.test(s2),
    );
    c(
      "…niente DROP, DELETE, TRUNCATE",
      [false, false, false],
      [/\bDROP\b/i.test(s2), /\bDELETE\b/i.test(s2), /\bTRUNCATE\b/i.test(s2)],
    );
    c(
      "…per tornare indietro: la riga c'è, nel commento",
      [true, false],
      [
        /--[^\n]*UPDATE public\.manychat_config SET canale = 'cloud' WHERE id = 1/.test(gr),
        /SET canale = 'cloud'/.test(s2),
      ],
    );
    c(
      "…controllo finale: una SELECT su user_id e il «fermati» se è vuoto",
      [true, true],
      [
        /SELECT id, user_id, canale, user_id IS NOT NULL[^;]*FROM public\.manychat_config WHERE id = 1;/.test(
          s2,
        ),
        /user_id è vuoto, FERMATI/.test(gr),
      ],
    );
    c(
      "…nessuna chiave: nemmeno una parola «Bearer» o «token»",
      false,
      /bearer|token|api_key/i.test(gr),
    );
  }

  /* ── il modello della prenotazione (stesso ordine dell'SQL) ───────────── */
  const ADESSO = Date.parse("2026-10-23T14:00:00Z");
  /** Il modello: ripete passo per passo `manychat_prenota_porta`. */
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
    if (
      db.invii.some(
        (i) =>
          i.user_id === userId &&
          i.telefono === tel &&
          ["prenotato", "inviato", "incerto"].includes(i.stato) &&
          (i.inviato_il ?? i.prenotato_il) > adesso - 120e3,
      )
    )
      return { motivo: "pausa_contatto" };
    const chiave = p.chiave || null;
    if (chiave && db.invii.some((i) => i.chiave === chiave)) return { motivo: "gia_preso" };
    const id = `inv-${db.invii.length + 1}`;
    db.invii.push({
      id,
      user_id: userId,
      lead_id: p.lead_id || null,
      tipo: p.tipo,
      chiave,
      telefono: tel,
      stato: "prenotato",
      prenotato_il: adesso,
    });
    return { id };
  };
  const db0 = (o = {}) => ({ giro: true, invii: [], contatti: [], ...o });

  let db = db0({
    contatti: [{ user_id: "u", phone_e164: "+393331234567", non_scrivere_dal: "x" }],
  });
  c(
    "modello · STOP con «+» → stop",
    "stop",
    prenota(db, "u", { tipo: "conferma", telefono: "393331234567" }).motivo,
  );
  db = db0({ contatti: [{ user_id: "u", phone_e164: "393331234567", non_scrivere_dal: "x" }] });
  c(
    "modello · STOP su riga vecchia senza «+» → stop",
    "stop",
    prenota(db, "u", { tipo: "conferma", telefono: "393331234567" }).motivo,
  );
  db = db0({ contatti: [{ user_id: "u", phone_e164: "+393331234567", non_scrivere_dal: null }] });
  c(
    "modello · contatto senza STOP → si prenota",
    true,
    !!prenota(db, "u", { tipo: "conferma", telefono: "393331234567" }).id,
  );
  db = db0({
    contatti: [{ user_id: "altro", phone_e164: "+393331234567", non_scrivere_dal: "x" }],
  });
  c(
    "modello · STOP di un'altra installazione non conta",
    true,
    !!prenota(db, "u", { tipo: "chat", telefono: "393331234567" }).id,
  );

  db = db0();
  const a = prenota(db, "u", { tipo: "conferma", telefono: "393331234567", chiave: "c|1" });
  c("modello · prima prenotazione → un id", true, !!a.id);
  c(
    "modello · secondo invio allo stesso telefono subito dopo → pausa_contatto",
    "pausa_contatto",
    prenota(db, "u", { tipo: "chat", telefono: "393331234567" }, ADESSO + 30e3).motivo,
  );
  c(
    "modello · dopo 121 s → si può",
    true,
    !!prenota(db, "u", { tipo: "chat", telefono: "393331234567" }, ADESSO + 121e3).id,
  );
  c(
    "modello · un altro telefono non c'entra con la pausa",
    true,
    !!prenota(db, "u", { tipo: "chat", telefono: "393339999999" }, ADESSO + 30e3).id,
  );

  for (const stato of ["saltato", "fallito"]) {
    db = db0({
      invii: [
        { id: "v", user_id: "u", telefono: "393331234567", stato, prenotato_il: ADESSO - 10e3 },
      ],
    });
    c(
      `modello · un invio «${stato}» 10 s fa NON blocca`,
      true,
      !!prenota(db, "u", { tipo: "chat", telefono: "393331234567" }).id,
    );
  }
  for (const stato of ["prenotato", "inviato", "incerto"]) {
    db = db0({
      invii: [
        { id: "v", user_id: "u", telefono: "393331234567", stato, prenotato_il: ADESSO - 10e3 },
      ],
    });
    c(
      `modello · un invio «${stato}» 10 s fa blocca`,
      "pausa_contatto",
      prenota(db, "u", { tipo: "chat", telefono: "393331234567" }).motivo,
    );
  }
  db = db0({
    invii: [
      {
        id: "v",
        user_id: "u",
        telefono: "393331234567",
        stato: "prenotato",
        prenotato_il: ADESSO - 700e3,
      },
    ],
  });
  prenota(db, "u", { tipo: "chat", telefono: "393331234567" });
  c("modello · «prenotato» da 11 minuti → diventa «incerto»", "incerto", db.invii[0].stato);

  db = db0();
  prenota(db, "u", { tipo: "conferma", telefono: "393331234567", chiave: "c|9" });
  c(
    "modello · stessa chiave su un altro telefono → gia_preso",
    "gia_preso",
    prenota(db, "u", { tipo: "conferma", telefono: "393330000000", chiave: "c|9" }).motivo,
  );
  db = db0();
  prenota(db, "u", { tipo: "chat", telefono: "393331234567" });
  prenota(db, "u", { tipo: "chat", telefono: "393331234567" }, ADESSO + 200e3);
  c("modello · senza chiave (la chat) non c'è mai conflitto", 2, db.invii.length);
  c(
    "modello · lead_id può mancare (webinar)",
    [null, null],
    [db.invii[0].lead_id, db.invii[1].lead_id],
  );
  c(
    "modello · senza la riga del giro non prenota niente",
    "manca_riga_giro",
    prenota(db0({ giro: false }), "u", { tipo: "chat", telefono: "393331234567" }).motivo,
  );
  c(
    "modello · senza utente o senza telefono → dati mancanti",
    ["dati_mancanti", "dati_mancanti"],
    [prenota(db0(), null, { telefono: "3" }).motivo, prenota(db0(), "u", { telefono: "" }).motivo],
  );
  db = db0({
    contatti: [{ user_id: "u", phone_e164: "+393331234567", non_scrivere_dal: "x" }],
    invii: [
      {
        id: "v",
        user_id: "u",
        telefono: "393331234567",
        stato: "inviato",
        prenotato_il: ADESSO - 5e3,
      },
    ],
  });
  c(
    "modello · STOP e pausa insieme → dice «stop» (non «riprova»)",
    "stop",
    prenota(db, "u", { tipo: "conferma", telefono: "393331234567" }).motivo,
  );
  await proveMigrazioniGiro({ c, gruppo, radice });
}

/** ═══════════════════════════════════════════════════════════════════════════
 *  M2 (il giro e il secondo stato) e M3 (il cron del giro) — compito 3
 *  ═══════════════════════════════════════════════════════════════════════════ */
async function proveMigrazioniGiro({ c, gruppo, radice }) {
  gruppo("MANYCHAT · M2 E M3, LE MIGRAZIONI DEL GIRO (TESTO)");
  const p2 = join(radice, "supabase/migrations/20261023120100_manychat_giro.sql");
  const p3 = join(radice, "supabase/migrations/20261023120200_manychat_cron.sql");
  c("M2 e M3 esistono col nome del piano", [true, true], [existsSync(p2), existsSync(p3)]);
  if (!existsSync(p2) || !existsSync(p3)) return;
  const grezzo2 = readFileSync(p2, "utf8");
  const grezzo3 = readFileSync(p3, "utf8");
  const sql = senzaCommenti(grezzo2);
  const alto = sql.toUpperCase();
  const pos = (re, da = 0) => {
    const m = re.exec(sql.slice(da));
    return m ? da + m.index : -1;
  };

  /* ── solo aggiunte ────────────────────────────────────────────────────── */
  c(
    "M2: niente DROP, DELETE, TRUNCATE fuori dai commenti",
    [false, false, false],
    [/\bDROP\b/.test(alto), /\bDELETE\b/.test(alto), /\bTRUNCATE\b/.test(alto)],
  );
  c(
    "…il «come si annulla» c'è, ma solo nel commento",
    [true, true],
    [/COME SI ANNULLA/i.test(grezzo2), /--\s*DROP /.test(grezzo2)],
  );
  c("M2: nessun ALTER TABLE, nessuna tabella nuova, nessuna policy", [false, false, false], [
    /\bALTER TABLE\b/i.test(sql),
    /\bCREATE TABLE\b/i.test(sql),
    /\bCREATE POLICY\b/i.test(sql),
  ]);
  c(
    "UPDATE solo su manychat_invii, manychat_giro e crm_leads (il secondo stato)",
    true,
    [...sql.matchAll(/\bUPDATE\s+public\.(\w+)/gi)].every(([, t]) =>
      ["manychat_invii", "manychat_giro", "crm_leads"].includes(t),
    ),
  );
  c("niente chiamate fuori dal database (net, cron) in M2", false, /\bnet\.|\bcron\./i.test(sql));
  c(
    "il cron del giro NON è in M2 (è di M3)",
    false,
    /manychat-giro|programma_hook_cron/i.test(sql),
  );
  c("i delimitatori $$ sono in numero pari", 0, (sql.match(/\$\$/g) ?? []).length % 2);
  c("NOTIFY pgrst per ricaricare lo schema", true, /NOTIFY pgrst, 'reload schema'/i.test(sql));

  /* ── le funzioni, chiuse ──────────────────────────────────────────────── */
  const firme = {
    manychat_prendi_giro: "uuid, integer",
    manychat_lascia_giro: "uuid",
    manychat_prenota_giro: "uuid, jsonb, jsonb, integer",
    manychat_giro_annulla: "uuid, uuid, text",
    manychat_risposta_arrivata: "uuid, uuid, timestamptz",
    contatto_wa_aggiorna: "uuid, uuid, jsonb, jsonb, text",
  };
  for (const [nome, args] of Object.entries(firme)) {
    const f = corpoFunzione(sql, nome);
    c(
      `${nome}: SECURITY DEFINER, search_path fissato`,
      [true, true],
      [/SECURITY DEFINER/i.test(f), /SET search_path = public/i.test(f)],
    );
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
  }

  /* ── il lucchetto ─────────────────────────────────────────────────────── */
  const prendi = corpoFunzione(sql, "manychat_prendi_giro");
  c(
    "lucchetto: si prende solo se è libero o scaduto, in un solo UPDATE",
    true,
    /UPDATE public\.manychat_giro[\s\S]*?WHERE id = 1\s+AND \(lucchetto_fino IS NULL OR lucchetto_fino < now\(\)\)/i.test(
      prendi,
    ),
  );
  c("…per i secondi chiesti, limitati fra 1 e 300", true, /GREATEST\(1, LEAST\(coalesce\(p_secondi, 120\), 300\)\)/i.test(prendi));
  c("…vero solo se ha toccato la riga", true, /ROW_COUNT[\s\S]*RETURN n = 1/i.test(prendi));
  c(
    "lascia: toglie il lucchetto solo se è ancora il suo (lucchetto_di = p_di)",
    true,
    /WHERE id = 1 AND lucchetto_di = p_di/i.test(corpoFunzione(sql, "manychat_lascia_giro")),
  );

  /* ── la prenotazione del giro: L'ORDINE ───────────────────────────────── */
  const pr = corpoFunzione(sql, "manychat_prenota_giro");
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
    "prenota_giro: ci si mette in fila PRIMA di tutto (FOR UPDATE sulla riga del giro)",
    true,
    passi.fila > 0 && Object.values(passi).every((v) => v >= passi.fila),
  );
  c(
    "…poi prenotato > 10' → incerto, tetti, STOP, pausa, ritmo, inserimento, posto del ritmo (in quest'ordine)",
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
  const aggiornaGiro = [...pr.matchAll(/UPDATE public\.manychat_giro/gi)].map((m) => m.index);
  c(
    "…il ritmo si controlla SENZA scrivere: ogni UPDATE del giro viene DOPO l'inserimento",
    true,
    aggiornaGiro.length >= 2 && aggiornaGiro.every((i) => i > passi.inserisce),
  );
  c(
    "…e il ritmo letto è prossimo_ricontatto_dopo (il solo ricontatto) con -infinity se vuoto",
    true,
    /v_tipo = 'ricontatto' AND coalesce\(v_ritmo, '-infinity'::timestamptz\) > now\(\)/i.test(pr),
  );
  c(
    "se non inserisce → gia_preso, PRIMA del posto del ritmo (che non si consuma)",
    true,
    (() => {
      const g = dentro(/'gia_preso'/);
      return g > passi.inserisce && g < passi.posto;
    })(),
  );
  c(
    "il posto del ritmo: intervallo limitato GREATEST(27, LEAST(33, …))",
    true,
    /GREATEST\(27, LEAST\(33, coalesce\(p_intervallo_min, 30\)\)\)/i.test(pr),
  );
  c(
    "…il ricontatto lo fissa a adesso + i minuti; il promemoria lo sposta solo in avanti",
    [true, true],
    [
      /v_tipo = 'ricontatto' THEN\s+UPDATE public\.manychat_giro\s+SET prossimo_ricontatto_dopo = now\(\) \+ make_interval\(mins => v_i\)/i.test(
        pr,
      ),
      /GREATEST\(coalesce\(prossimo_ricontatto_dopo, now\(\)\), now\(\) \+ make_interval\(mins => v_i\)\)/i.test(
        pr,
      ),
    ],
  );
  c(
    "inserimento: ON CONFLICT (chiave) WHERE chiave IS NOT NULL DO NOTHING",
    true,
    /ON CONFLICT \(chiave\) WHERE chiave IS NOT NULL DO NOTHING/i.test(pr),
  );
  c(
    "«prenotato» da più di 10 minuti → incerto (solo dell'utente)",
    true,
    /UPDATE public\.manychat_invii\s+SET stato = 'incerto'[\s\S]*?WHERE user_id = p_user_id\s+AND stato = 'prenotato'\s+AND prenotato_il < now\(\) - interval '10 minutes'/i.test(
      pr,
    ),
  );
  /* tetti */
  const tettiSql = pr.slice(passi.fila, passi.stop);
  c(
    "tetti: le costanti 20, 40 e 10 stanno nell'SQL",
    [true, true, true],
    [
      /v_tetto_ric constant int := 20/.test(pr),
      /v_tetto_tot constant int := 40/.test(pr),
      /v_tetto_prima constant int := 10/.test(pr),
    ],
  );
  c(
    "…il riquadro può solo ABBASSARE (LEAST con la costante, solo se è un numero)",
    [true, true],
    [
      /p_tetti->>'ricontatti', ''\) ~ '\^\\d\{1,6\}\$'[\s\S]*?LEAST\(v_tetto_ric, \(p_tetti->>'ricontatti'\)::int\)/i.test(tettiSql),
      /p_tetti->>'totale', ''\) ~ '\^\\d\{1,6\}\$'[\s\S]*?LEAST\(v_tetto_tot, \(p_tetti->>'totale'\)::int\)/i.test(tettiSql),
    ],
  );
  c(
    "…la prima settimana si decide QUI da manychat_config.prima_accensione, non da un parametro",
    [true, true],
    [
      /SELECT prima_accensione INTO v_prima FROM public\.manychat_config WHERE id = 1/i.test(tettiSql),
      /now\(\) < coalesce\(v_prima, now\(\)\) \+ interval '7 days'/i.test(tettiSql),
    ],
  );
  c(
    "…senza data di prima accensione vale la prima settimana (coalesce, il tetto più basso)",
    true,
    /coalesce\(v_prima, now\(\)\)/i.test(tettiSql) && !/p_tetti->>'prima/i.test(pr),
  );
  c(
    "…il giorno è quello di Roma, e contano prenotato/inviato/incerto di promemoria e ricontatto",
    [true, true, true],
    [
      /Europe\/Rome/.test(tettiSql),
      /tipo IN \('promemoria', 'ricontatto'\)/.test(tettiSql),
      /stato IN \('prenotato', 'inviato', 'incerto'\)/.test(tettiSql),
    ],
  );
  c(
    "…il tetto dei ricontatti vale solo per i ricontatti; quello totale per tutti",
    [true, true],
    [
      /v_tot >= v_max_tot THEN\s+RETURN jsonb_build_object\('motivo', 'tetto_totale'\)/i.test(tettiSql),
      /v_tipo = 'ricontatto' AND v_ric >= v_max_ric/i.test(tettiSql),
    ],
  );
  /* STOP e pausa */
  c(
    "STOP col «+» e senza (righe vecchie), solo i contatti dell'utente",
    [true, true, true],
    [
      /c\.phone_e164 = '\+' \|\| v_tel/.test(pr),
      /ltrim\(c\.phone_e164, '\+'\) = v_tel/.test(pr),
      /c\.user_id = p_user_id[\s\S]{0,80}non_scrivere_dal IS NOT NULL/i.test(pr),
    ],
  );
  const primaPausa = pr.slice(passi.pausa - 700, passi.pausa);
  c(
    "pausa: prenotato, inviato, incerto degli ultimi 120 s, mai saltato né fallito",
    [true, true, false, false],
    [
      /stato IN \('prenotato', 'inviato', 'incerto'\)/i.test(primaPausa),
      /v_pausa_s/.test(primaPausa) && /v_pausa_s\s+constant int := 120/.test(pr),
      /saltato/i.test(primaPausa),
      /fallito/i.test(primaPausa),
    ],
  );
  c(
    "tutto con l'utente nel WHERE o nel VALUES",
    true,
    (pr.match(/user_id = p_user_id/g) ?? []).length >= 4 && /VALUES\s*\(p_user_id/i.test(pr),
  );
  c(
    "un tipo che non è promemoria o ricontatto è un errore del chiamante, non un «motivo»",
    true,
    /v_tipo NOT IN \('promemoria', 'ricontatto'\) THEN\s+RAISE EXCEPTION/i.test(pr),
  );
  c("lead_id facoltativo", true, /nullif\(p->>'lead_id', ''\)::uuid/i.test(pr));
  c("la funzione non chiama nessuno fuori", false, /net\.|http|cron\./i.test(pr));

  /* ── annulla: «saltato» SENZA chiave ───────────────────────────────────── */
  const an = corpoFunzione(sql, "manychat_giro_annulla");
  c(
    "annulla: stato «saltato» e chiave NULL (la riga non tiene occupato il giorno)",
    [true, true],
    [/stato = 'saltato'/.test(an), /chiave = NULL/.test(an)],
  );
  c(
    "…solo se è ancora prenotato o fallito, solo dell'utente",
    [true, true],
    [/stato IN \('prenotato', 'fallito'\)/.test(an), /user_id = p_user_id/.test(an)],
  );

  /* ── l'ora della risposta ─────────────────────────────────────────────── */
  const ra = corpoFunzione(sql, "manychat_risposta_arrivata");
  c(
    "risposta_arrivata: la PRIMA risposta resta (coalesce), solo dell'utente",
    [true, true],
    [/SET risposta_il = coalesce\(risposta_il, p_il\)/.test(ra), /id = p_id AND user_id = p_user_id/.test(ra)],
  );
  c(
    "…e l'ora dell'ultima risposta va sul giro (per «nessuna risposta da 48 ore»); p_id può mancare",
    [true, true],
    [/ultima_risposta_il = GREATEST\(coalesce\(ultima_risposta_il, p_il\), p_il\)/.test(ra), /IF p_id IS NOT NULL THEN/.test(ra)],
  );

  /* ── il secondo stato ─────────────────────────────────────────────────── */
  const cw = corpoFunzione(sql, "contatto_wa_aggiorna");
  c(
    "contatto_wa_aggiorna: tocca SOLO data.contattoWa (jsonb_set su '{contattoWa}')",
    [true, true],
    [/jsonb_set\(coalesce\(v_dati, '\{\}'::jsonb\), '\{contattoWa\}', v_nuovo, true\)/.test(cw), (cw.match(/UPDATE public\.crm_leads/gi) ?? []).length === 1],
  );
  c(
    "…con la scheda bloccata e l'utente sia nella lettura sia nella scrittura",
    [true, true],
    [
      /WHERE id = p_id AND user_id = p_user_id\s+FOR UPDATE/i.test(cw),
      /UPDATE public\.crm_leads[\s\S]*?WHERE id = p_id AND user_id = p_user_id/i.test(cw),
    ],
  );
  const iStop = cw.search(/v_prima->>'stato' = 'stop' AND coalesce\(v_patch->>'da', ''\) = 'automatico'/);
  const iUpdate = cw.search(/UPDATE public\.crm_leads/);
  c(
    "NOTA 2: lo STOP appiccicoso si ricontrolla DENTRO la funzione, prima dell'UPDATE (da = 'automatico')",
    true,
    iStop > 0 && iStop < iUpdate && /v_prima->>'stato' = 'stop'[\s\S]{0,120}RETURN false/i.test(cw),
  );
  c(
    "p_se_invio: vale solo sull'invioId della scheda; «Non ha risposto» solo se è ancora «In attesa»",
    [true, true],
    [
      /coalesce\(v_prima->>'invioId', ''\) <> p_se_invio THEN RETURN false/.test(cw),
      /v_patch->>'stato' = 'non_ha_risposto' AND coalesce\(v_prima->>'stato', ''\) <> 'in_attesa'/.test(cw),
    ],
  );
  c(
    "la fusione è quella di applicaCambio: stato/il/da/motivo/scadeRisposta sostituiti, invioId e sbloccatoIl conservati",
    [true, true],
    [
      /v_prima - 'stato' - 'il' - 'da' - 'motivo' - 'scadeRisposta'/.test(cw),
      !/- 'invioId'|- 'sbloccatoIl'/.test(cw),
    ],
  );
  c("…i valori nulli della patch non cancellano niente (jsonb_strip_nulls)", true, /jsonb_strip_nulls/.test(cw));
  c(
    "…storia: la voce nuova in testa, al massimo 20",
    [true, true],
    [/jsonb_build_array\(coalesce\(p_voce, '\{\}'::jsonb\)\) \|\| coalesce\(v_prima->'storia'/.test(cw), /LIMIT 20/.test(cw)],
  );
  c(
    "…lo stato deve essere uno dei sette",
    true,
    /NOT IN\s*\('contattato', 'in_attesa', 'ha_risposto', 'non_ha_risposto', 'da_ricontattare', 'stop', 'non_raggiungibile'\)/.test(cw),
  );

  /* ── il riempimento una tantum di risposta_il ─────────────────────────── */
  const riempi = sql.slice(sql.search(/\nUPDATE public\.manychat_invii i\b/));
  c("riempimento: c'è, in fondo", true, /^\s*UPDATE public\.manychat_invii i\b/.test(riempi));
  c(
    "…tocca solo righe con risposta_il VUOTO (due volte: nel sotto-elenco e nell'UPDATE)",
    2,
    (riempi.match(/risposta_il IS NULL/gi) ?? []).length,
  );
  c(
    "…cerca la prima risposta in arrivo (inbound) dello stesso numero, dopo l'invio ed entro 7 giorni",
    [true, true, true, true],
    [
      /w\.direction = 'inbound'/.test(riempi),
      /ltrim\(w\.from_number, '\+'\) = i2\.telefono/.test(riempi),
      /w\.created_at > coalesce\(i2\.inviato_il, i2\.prenotato_il\)/.test(riempi),
      /interval '7 days'/.test(riempi),
    ],
  );
  c("…solo di installazioni uguali (user_id) e di invii partiti (inviato, incerto)", [true, true], [/w\.user_id = i2\.user_id/.test(riempi), /i2\.stato IN \('inviato', 'incerto'\)/.test(riempi)]);
  c("…e non cancella né azzera niente", false, /risposta_il = NULL|DELETE/i.test(riempi));

  /* ── M3: il cron, per ultimo ──────────────────────────────────────────── */
  const sql3 = senzaCommenti(grezzo3).trim();
  c(
    "M3: una sola istruzione, il cron del giro a 45 s con la funzione di M1",
    "SELECT public.programma_hook_cron_attesa('manychat-giro-1min', '* * * * *', '/hooks/manychat-giro', 45000);",
    sql3,
  );
  c(
    "…come spegnerlo e come vederlo girare stanno solo nel commento",
    [true, true, false],
    [/--\s+SELECT cron\.unschedule\('manychat-giro-1min'\)/.test(grezzo3), /cron\.job_run_details/.test(grezzo3), /unschedule|job_run_details/.test(sql3)],
  );
  c("…nessun altro lavoro di cron in M3", 1, (sql3.match(/programma_hook_cron/g) ?? []).length);
}
