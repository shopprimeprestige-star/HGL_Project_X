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
}
