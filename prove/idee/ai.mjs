/** ── PROVE: LE TRE IDEE DEL 30/10/2026 SULLA RISPOSTA AI ─────────────────────
 *
 *  Commessa 2026-10-30-idee-chat, ramo idee-ai.
 *   • idea 4, UN TOCCO: «Rispondi con AI» parte subito se c'è qualcuno da
 *     rispondere (si legge nel sorgente dell'aggancio: è codice React);
 *   • idea 5, BOZZE PRONTE: la scelta della chat (pura), il giro con porte
 *     finte, la rotta, la migrazione (testo SQL: qui non gira un Postgres);
 *   • idea 6, ORARI LIBERI: il testo compatto (puro), la colonna, il prompt.
 *  Dati inventati: nessun numero né nome vero.
 *
 *  `mod`: i moduli impacchettati da `prove/prove.mjs`. `aiuti`: { c, gruppo, radice }. */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ID = "11111111-2222-4333-8444-555555555555";
const SEG = "s".repeat(40);
const ADESSO = new Date("2026-10-30T12:00:00Z");
const fa = (ore) => new Date(ADESSO.getTime() - ore * 3_600_000).toISOString();

/** Il SQL senza i commenti `-- …` (il «come si annulla» ha DROP scritti apposta). */
const senzaCommenti = (sql) => sql.replace(/--[^\n]*/g, "");

export async function proveIdeeAi(mod, { c, gruppo, radice }) {
  const R = mod["risposte-ai/regole"];
  const I = mod["risposte-ai/ingresso"];
  const P = await import(join(radice, "strumenti/risposte-ai/src/prompt.mjs"));
  const leggi = (f) => readFileSync(join(radice, f), "utf8");

  /* ── IDEA 4 · UN TOCCO ─────────────────────────────────────────────── */
  gruppo("RISPOSTA AI · UN TOCCO (idea 4)");
  const aggancio = leggi("src/crm/chatwa/useRispostaAi.ts");
  c(
    "«Rispondi con AI»: con messaggi da rispondere parte subito",
    true,
    /const partenza = sceltiDiPartenza\(p\.messaggi\);[\s\S]*?if \(partenza\.length > 0\) void scrivi\(partenza\);/.test(
      aggancio,
    ),
  );
  c(
    "…senza messaggi si apre la scelta come prima (nessuna scrittura)",
    true,
    /setAttivo\(true\);\s*\/\/[^\n]*\n\s*if \(partenza\.length > 0\)/.test(aggancio),
  );
  c(
    "…si può smettere di aspettare e cambiare i messaggi (ferma)",
    true,
    /const ferma = \(\) => \{\s*giro\.current\+\+;\s*setFase\("scelta"\);/.test(aggancio),
  );
  c(
    "…annullare resta (chiudi)",
    true,
    /onClick=\{ai\.chiudi\}/.test(leggi("src/crm/chatwa/BarraRispostaAi.tsx")) &&
      /onClick=\{ai\.ferma\}/.test(leggi("src/crm/chatwa/BarraRispostaAi.tsx")),
  );
  const RS = mod["risposte-ai/regole"];
  c(
    "i messaggi di partenza: quelli del cliente dopo la nostra ultima",
    ["b", "c"],
    RS.sceltiDiPartenza([
      { id: "a", direction: "outbound", body: "Ciao" },
      { id: "b", direction: "inbound", body: "Salve" },
      { id: "c", direction: "inbound", body: "Costi?" },
    ]),
  );
  c(
    "…nessuno se l'ultima è nostra: si apre la scelta",
    [],
    RS.sceltiDiPartenza([
      { id: "b", direction: "inbound", body: "Salve" },
      { id: "c", direction: "outbound", body: "Ciao" },
    ]),
  );

  /* ── IDEA 6 · GLI ORARI LIBERI ─────────────────────────────────────── */
  gruppo("RISPOSTA AI · ORARI LIBERI NELLA RICHIESTA (idea 6)");
  const g = (data, ...ore) => ({ data, fasce: ore.map((ora) => ({ ora })) });
  c(
    "oggi, domani e un altro giorno, in una riga",
    "oggi 15:00, 17:30 · domani 10:00 · lun 2 nov 9:00, 12:00, 17:00",
    R.testoOrari(
      [
        g("2026-10-30", "15:00", "17:30"),
        g("2026-10-31", "10:00"),
        g("2026-11-02", "9:00", "10:00", "12:00", "14:00", "17:00"),
      ],
      "2026-10-30",
    ),
  );
  c(
    "al massimo 3 orari per giorno, sparsi (primo, mezzo, ultimo)",
    "oggi 9:00, 12:00, 17:00",
    R.testoOrari([g("2026-10-30", "9:00", "10:00", "12:00", "14:00", "17:00")], "2026-10-30"),
  );
  const molti = Array.from({ length: 7 }, (_, i) =>
    g(`2026-11-0${i + 1}`, "10:00", "11:00", "12:00"),
  );
  const t8 = R.testoOrari(molti, "2026-10-30");
  c("al massimo 8 orari in tutto", true, (t8.match(/\d{1,2}:\d{2}/g) ?? []).length === 8);
  c(
    "…e al massimo 400 caratteri",
    true,
    R.testoOrari(molti, "2026-10-30", { maxCaratteri: 60 }).length <= 60,
  );
  c(
    "…e sta nella colonna (600)",
    true,
    t8.length <= R.ORARI_CARATTERI && R.ORARI_CARATTERI <= R.LIMITE_ORARI,
  );
  c(
    "giorni senza posto saltati",
    "domani 10:00",
    R.testoOrari([g("2026-10-30"), g("2026-10-31", "10:00")], "2026-10-30"),
  );
  c(
    "giorni passati o storti: mai",
    null,
    R.testoOrari(
      [g("2026-10-29", "10:00"), g("boh", "11:00"), g("2026-10-30", "xx")],
      "2026-10-30",
    ),
  );
  c(
    "nessun orario: null (non si scrive la colonna)",
    [null, null, null],
    [
      R.testoOrari([], "2026-10-30"),
      R.testoOrari(null, "2026-10-30"),
      R.testoOrari([g("2026-10-30", "10:00")], "oggi"),
    ],
  );
  c(
    "la colonna manca (42703 o PGRST204): si riprova senza",
    [true, true, false, false],
    [
      R.colonnaMancante({ code: "42703" }),
      R.colonnaMancante({ code: "PGRST204" }),
      R.colonnaMancante({ code: "23505" }),
      R.colonnaMancante(null),
    ],
  );

  const msg = (id, direction, body, ore) => ({ id, direction, body, created_at: fa(ore) });
  const chat = [msg("a", "outbound", "Buongiorno", 5), msg("b", "inbound", "Quando potete?", 4)];
  const L = R.lavoroPerMac({
    id: ID,
    scelti: ["b"],
    messaggi: chat,
    orari: "oggi 15:00,\n17:30 · domani 10:00",
  });
  c("il lavoro porta gli orari in una riga sola", "oggi 15:00, 17:30 · domani 10:00", L.orari);
  c(
    "…senza orari: null",
    [null, null],
    [
      R.lavoroPerMac({ id: ID, scelti: ["b"], messaggi: chat }).orari,
      R.lavoroPerMac({ id: ID, scelti: ["b"], messaggi: chat, orari: "  " }).orari,
    ],
  );
  c(
    "…tagliati al limite della colonna",
    R.LIMITE_ORARI,
    R.lavoroPerMac({ id: ID, scelti: ["b"], messaggi: chat, orari: "x".repeat(900) }).orari.length,
  );
  const dom = P.domanda(L);
  c(
    "la domanda per Haiku ha l'elenco «ORARI LIBERI»",
    true,
    /ORARI LIBERI \(veri.*\): oggi 15:00, 17:30 · domani 10:00/.test(dom),
  );
  c(
    "…senza elenco dice di non proporre orari",
    true,
    /ORARI LIBERI: \(elenco non disponibile: non proporre orari\)/.test(
      P.domanda({ ...L, orari: null }),
    ),
  );
  const regole = P.istruzioni([]);
  c(
    "la regola: 2 o 3 orari dall'elenco, mai altri",
    true,
    /proponi 2 o 3 degli orari dell'elenco «ORARI LIBERI»/.test(regole) &&
      /Mai orari, giorni o date che non sono in quell'elenco/.test(regole),
  );
  const ui = leggi("src/crm/chatwa/useRispostaAi.ts");
  c(
    "il CRM prende gli orari da useGiorniLiberi (come Slot liberi)",
    true,
    /useGiorniLiberi\(\{ quanti: 7 \}\)/.test(ui) && /testoOrari\(giorniRef\.current/.test(ui),
  );
  c("…colonna mancante: ritenta senza orari", true, /orari && colonnaMancante\(error\)/.test(ui));

  /* ── IDEA 5 · LE BOZZE PRONTE ──────────────────────────────────────── */
  gruppo("RISPOSTA AI · BOZZE PRONTE SU «DA RISPONDERE» (idea 5)");
  const cont = (tel, ore, extra = {}) => ({
    phone_e164: tel,
    lead_id: `lead-${tel}`,
    ultimo_in_entrata_il: fa(ore),
    risposto_il: null,
    non_scrivere_dal: null,
    ...extra,
  });
  const tel = (r) => R.chatPerBozza(r, ADESSO).map((x) => x.telefono);
  c("una chat che aspetta, con la scheda: sì", ["+39111"], tel([cont("+39111", 2)]));
  c("oltre 24 ore: no", [], tel([cont("+39111", 25)]));
  c("senza scheda: no", [], tel([cont("+39111", 2, { lead_id: null })]));
  c("con STOP: no", [], tel([cont("+39111", 2, { non_scrivere_dal: fa(1) })]));
  c("già risposto dopo il messaggio: no", [], tel([cont("+39111", 2, { risposto_il: fa(1) })]));
  c(
    "risposto prima del messaggio: sì",
    ["+39111"],
    tel([cont("+39111", 2, { risposto_il: fa(3) })]),
  );
  c(
    "senza data di entrata / data illeggibile: no",
    [],
    tel([
      cont("+39111", 2, { ultimo_in_entrata_il: null }),
      cont("+39222", 2, { ultimo_in_entrata_il: "boh" }),
    ]),
  );
  c("la più recente prima", ["+39222", "+39111"], tel([cont("+39111", 5), cont("+39222", 1)]));
  c(
    "al massimo quante la ricerca ne guarda",
    R.BOZZE_CHAT_MAX,
    tel(Array.from({ length: 40 }, (_, i) => cont(`+39${100 + i}`, 1 + i / 100))).length,
  );

  const ult = (...m) => R.sceltiPerBozza(m, ADESSO);
  c(
    "ultimo messaggio del cliente, recente: i suoi messaggi",
    { scelti: ["b", "c"], ultimoIl: fa(1) },
    ult(
      msg("a", "outbound", "Ciao", 5),
      msg("b", "inbound", "Salve", 2),
      msg("c", "inbound", "Quanto costa?", 1),
    ),
  );
  c(
    "l'ultimo è nostro: no",
    null,
    ult(msg("b", "inbound", "Salve", 2), msg("c", "outbound", "Ciao", 1)),
  );
  c(
    "l'ultimo del cliente è senza testo (foto): no",
    null,
    ult(msg("b", "inbound", "Salve", 2), msg("c", "inbound", null, 1)),
  );
  c("l'ultimo del cliente è di oltre 24 ore: no", null, ult(msg("b", "inbound", "Salve", 26)));
  c("nessun messaggio: no", null, R.sceltiPerBozza([], ADESSO));
  c(
    "ricerca a vuoto al massimo ogni 30 secondi",
    [false, false, true],
    [
      R.tempoDiCercareBozza(1000, 1000 + 29_000),
      R.tempoDiCercareBozza(1000, 1000),
      R.tempoDiCercareBozza(1000, 1000 + 30_000),
    ],
  );

  //  Il giro con letture finte
  const finteLetture = (o = {}) => {
    const reg = { creati: [], chiamate: [] };
    return {
      reg,
      letture: {
        automaticheRecenti: async () => (reg.chiamate.push("tetto"), o.fatte ?? 0),
        contatti: async () => (reg.chiamate.push("contatti"), o.contatti ?? [cont("+39111", 2)]),
        messaggi: async () => (
          reg.chiamate.push("messaggi"),
          o.messaggi ?? [msg("b", "inbound", "Quando potete?", 1)]
        ),
        richiestaDopo: async () => (reg.chiamate.push("richiesta"), o.richiesta ?? false),
        schedaEsiste: async () => (reg.chiamate.push("scheda"), o.scheda ?? true),
        crea: async (t, lead, scelti) => (
          reg.creati.push([t, lead, scelti]),
          { id: ID, telefono: t, messaggi: scelti, indicazione: null, orari: null }
        ),
      },
    };
  };
  let f = finteLetture();
  let q = await I.preparaBozza(f.letture, ADESSO);
  c(
    "tutto in regola: una bozza, con i messaggi del cliente",
    [ID, [["+39111", "lead-+39111", ["b"]]]],
    [q?.id, f.reg.creati],
  );
  f = finteLetture({ fatte: 40 });
  c(
    "al tetto del giorno (40): niente, e nemmeno una ricerca",
    [null, ["tetto"]],
    [await I.preparaBozza(f.letture, ADESSO), f.reg.chiamate],
  );
  f = finteLetture({ fatte: 39 });
  c("39 fatte: ancora una", true, Boolean(await I.preparaBozza(f.letture, ADESSO)));
  f = finteLetture({ richiesta: true });
  c(
    "c'è già una richiesta dopo l'ultimo messaggio: niente",
    [null, 0],
    [await I.preparaBozza(f.letture, ADESSO), f.reg.creati.length],
  );
  f = finteLetture({ scheda: false });
  c(
    "la scheda non c'è più: niente",
    [null, 0],
    [await I.preparaBozza(f.letture, ADESSO), f.reg.creati.length],
  );
  f = finteLetture({
    messaggi: [msg("b", "inbound", "Salve", 2), msg("c", "outbound", "Ciao", 1)],
  });
  c(
    "l'ultimo messaggio è nostro: niente",
    [null, 0],
    [await I.preparaBozza(f.letture, ADESSO), f.reg.creati.length],
  );
  f = finteLetture({ contatti: [cont("+39111", 2, { non_scrivere_dal: fa(1) })] });
  c(
    "STOP: niente, e non si leggono nemmeno i messaggi",
    [null, false],
    [await I.preparaBozza(f.letture, ADESSO), f.reg.chiamate.includes("messaggi")],
  );
  f = finteLetture({ contatti: [cont("+39111", 3), cont("+39222", 1)] });
  const lette = [];
  f.letture.richiestaDopo = async (t) => (lette.push(t), t === "+39222");
  q = await I.preparaBozza(f.letture, ADESSO);
  c(
    "salta la chat già servita e passa alla successiva",
    [["+39222", "+39111"], "+39111"],
    [lette, q.telefono],
  );

  //  La rotta
  const lavoroRotta = async (o) => {
    const reg = { bozze: 0, prese: 0 };
    const porte = {
      avviso: () => {},
      utente: async () => "U1",
      battito: async () => {},
      prendi: async () => (reg.prese++, o.coda ?? null),
      bozza: async (u) => (reg.bozze++, (reg.utente = u), o.bozza ?? null),
      messaggiChat: async () => [msg("b", "inbound", "Quando potete?", 1)],
      scheda: async () => ({ lead: { nome: "Mario" }, consulente: null }),
      chiudi: async () => true,
    };
    const r = await I.gestisciRisposteAi(porte, {
      request: new Request("https://x/api/public/risposte-ai", {
        method: "POST",
        headers: { "x-hgl-token": SEG },
        body: JSON.stringify({ azione: "prendi" }),
      }),
      segreto: SEG,
    });
    return { stato: r.status, corpo: await r.json(), reg };
  };
  let r = await lavoroRotta({
    bozza: { id: ID, telefono: "+39111", messaggi: ["b"], indicazione: null },
  });
  c(
    "coda vuota: la rotta dà la bozza come lavoro normale",
    [200, ID, true, 1],
    [r.stato, r.corpo.lavoro?.id, r.corpo.lavoro?.messaggi.some((m) => m.scelto), r.reg.bozze],
  );
  c("…con l'utente dell'installazione", "U1", r.reg.utente);
  r = await lavoroRotta({
    coda: { id: ID, telefono: "+39111", messaggi: ["b"], indicazione: null, orari: "oggi 15:00" },
    bozza: { id: "x", telefono: "+39111", messaggi: ["b"], indicazione: null },
  });
  c(
    "se c'è una richiesta in coda, la bozza non si prepara",
    [ID, 0],
    [r.corpo.lavoro.id, r.reg.bozze],
  );
  c("…e gli orari della richiesta arrivano al Mac", "oggi 15:00", r.corpo.lavoro.orari);
  r = await lavoroRotta({});
  c("niente in coda e nessuna bozza: lavoro null", [200, null], [r.stato, r.corpo.lavoro]);

  //  Il sorgente
  const srv = leggi("src/crm/risposte-ai/porte.server.ts");
  c(
    "porte: la bozza non rompe mai la rotta (errori presi, colonna mancante in silenzio)",
    true,
    /bozza: async \(userId\) => \{[\s\S]*?catch \(e\) \{[\s\S]*?colonnaMancante\(e[\s\S]*?return null;/.test(
      srv,
    ),
  );
  c(
    "porte: la bozza nasce già «in_lavoro», automatica, con utente e lead",
    true,
    /automatica: true,[\s\S]*?stato: "in_lavoro"/.test(srv) &&
      /user_id: userId,\s+telefono,\s+lead_id: leadId/.test(srv),
  );
  c(
    "porte: il tetto e la ricerca a vuoto limitata",
    true,
    /\.eq\("automatica", true\)/.test(srv) && /tempoDiCercareBozza\(ultimaRicercaBozza/.test(srv),
  );
  const bloccoBozza = srv.slice(
    srv.indexOf("const lettureBozza"),
    srv.indexOf("export function porteRisposteAi"),
  );
  const cateneBozza = bloccoBozza.split(/\.from\(/).slice(1);
  c(
    "porte: 6 query della bozza, ognuna filtrata per utente",
    [6, []],
    [
      cateneBozza.length,
      cateneBozza
        .filter((t) => !/\.eq\("user_id", userId\)|user_id: userId,/.test(t.split(";")[0]))
        .map((t) => t.slice(0, 30)),
    ],
  );
  c(
    "porte: lo STOP e la scheda nella lettura dei contatti",
    true,
    /\.is\("non_scrivere_dal", null\)/.test(srv) && /\.not\("lead_id", "is", null\)/.test(srv),
  );
  const bozzaUi = leggi("src/crm/chatwa/BozzaAiPronta.tsx");
  c(
    "la chat: «Bozza AI pronta» con «Usa» e «Scarta»",
    true,
    /Bozza AI pronta/.test(bozzaUi) &&
      />\s*Usa\s*</.test(bozzaUi) &&
      />\s*Scarta\s*</.test(bozzaUi),
  );
  const conv = leggi("src/crm/chatwa/Conversazione.tsx");
  c(
    "«Usa» e la risposta AI passano dalla stessa funzione: aggiunge sotto, non sovrascrive",
    true,
    /const mettiInCasella = \(t: string\) => \{[\s\S]*?prima \? `\$\{bozzaRef\.current\.trimEnd\(\)\}\\n\\n\$\{t\}` : t/.test(
      conv,
    ) &&
      /onRisposta: mettiInCasella/.test(conv) &&
      /mettiInCasella\(bozzaAi\.bozza/.test(conv),
  );
  c(
    "la bozza sta sopra la casella e non nella scelta AI",
    true,
    /!ai\.attivo && bozzaAi\.bozza\?\.risposta && \(\s*<BozzaAiPronta/.test(conv),
  );
  const hook = leggi("src/crm/chatwa/useBozzaAi.ts");
  c(
    "l'aggancio: solo bozze automatiche «pronte», colonna mancante = nessuna bozza",
    true,
    /\.eq\("automatica", true\)/.test(hook) &&
      /\.eq\("stato", "pronta"\)/.test(hook) &&
      /colonnaMancante\(error\)/.test(hook),
  );

  //  La regola di chi mostra la bozza
  const b = (id, ore, risposta = "Buongiorno") => ({ id, risposta, creata_il: fa(ore) });
  const m2 = [msg("a", "inbound", "Salve", 3)];
  c(
    "bozza più recente dell'ultimo messaggio del cliente: si mostra",
    "b1",
    R.bozzaDaMostrare([b("b1", 2)], m2, [])?.id,
  );
  c("bozza più vecchia dell'ultimo messaggio: no", null, R.bozzaDaMostrare([b("b1", 4)], m2, []));
  c("scartata: no", null, R.bozzaDaMostrare([b("b1", 2)], m2, ["b1"]));
  c("vuota: no", null, R.bozzaDaMostrare([b("b1", 2, "  ")], m2, []));
  c(
    "abbiamo già risposto dopo la bozza: no",
    null,
    R.bozzaDaMostrare([b("b1", 2)], [...m2, msg("z", "outbound", "Ok", 1)], []),
  );
  c("la più recente fra due", "b2", R.bozzaDaMostrare([b("b1", 2), b("b2", 1)], m2, [])?.id);
  c("senza messaggi del cliente: no", null, R.bozzaDaMostrare([b("b1", 2)], [], []));

  //  La migrazione (testo SQL)
  const FILE = "20261030100000_risposte_ai_bozze.sql";
  const sql = leggi(`supabase/migrations/${FILE}`);
  const codice = senzaCommenti(sql);
  c(
    "migrazione: la colonna automatica boolean default false, solo se manca",
    true,
    /ALTER TABLE public\.wa_risposte_ai\s+ADD COLUMN IF NOT EXISTS automatica boolean NOT NULL DEFAULT false;/.test(
      codice,
    ),
  );
  c(
    "migrazione: la colonna orari, text, al massimo 600",
    true,
    /ADD COLUMN IF NOT EXISTS orari text CHECK \(orari IS NULL OR char_length\(orari\) <= 600\);/.test(
      codice,
    ),
  );
  c(
    "migrazione: solo due ALTER ADD COLUMN, nient'altro",
    [2, ""],
    [
      (codice.match(/\bALTER TABLE\b/g) ?? []).length,
      codice
        .replace(/ALTER TABLE public\.wa_risposte_ai\s+ADD COLUMN IF NOT EXISTS [^;]*;/g, "")
        .trim(),
    ],
  );
  c(
    "migrazione: niente che cancelli o tocchi dati (fuori dai commenti)",
    false,
    /DROP|DELETE|TRUNCATE|UPDATE|INSERT|POLICY|FUNCTION|ALTER COLUMN/i.test(codice),
  );
  c(
    "migrazione: «COME SI ANNULLA» nel commento, con le due colonne",
    true,
    /COME SI ANNULLA/.test(sql) &&
      /--\s+ALTER TABLE public\.wa_risposte_ai DROP COLUMN IF EXISTS automatica;/.test(sql) &&
      /--\s+ALTER TABLE public\.wa_risposte_ai DROP COLUMN IF EXISTS orari;/.test(sql),
  );
  c(
    "migrazione: dice che senza di lei tutto va come prima",
    true,
    /SENZA QUESTA MIGRAZIONE/.test(sql),
  );
  const altre = readdirSync(join(radice, "supabase/migrations"))
    .filter((n) => n.endsWith(".sql") && n !== FILE && !n.includes("risposte_ai") && !n.includes("riepilogo_serale"))
    .sort();
  c(
    "migrazione: viene dopo tutte le altre, tranne le sorelle della risposta AI",
    true,
    FILE.slice(0, 14) > altre.at(-1).slice(0, 14),
  );
  c("migrazione: dopo quella della tabella", true, FILE.slice(0, 14) > "20261029200000");
}
