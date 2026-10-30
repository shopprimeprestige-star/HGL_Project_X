/** ── PROVE: IL CONTROLLO DELLA NOTTE DEL GIRO WHATSAPP ──
 *
 *  Commessa 2026-10-30-ottimizzazioni, pacchetto p8-controllo-notte, punti
 *  (20) e (9). Prova la regola pura (`src/crm/controllo-notte/regole.ts`,
 *  impacchettata qui a parte come fa `prove/ponte/banner.mjs`), più il testo
 *  della migrazione e della rotta. Il comportamento vero della funzione SQL lo
 *  prova `prove/sql/controllo-notte.sql` su un Postgres (vedi
 *  `prove/sql/LEGGIMI.md`). Dati inventati: nessun numero né nome vero.
 *
 *  `mod`: i moduli impacchettati da `prove/prove.mjs`. `aiuti`: `{ c, gruppo, radice }`. */
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Parole che il titolare non deve leggere in un avviso. */
const VIETATE =
  /\b(QR|Baileys|token|JID|LID|sessione|battito|server|database|API|socket|log|RPC|SQL|null|undefined|NaN)\b/i;

const senzaCommenti = (sql) =>
  sql
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/--[^\n]*/g, "")
    .replace(/[ \t]+\n/g, "\n");

export async function proveControlloNotte(_mod, { c, gruppo, radice }) {
  const esbuild = createRequire(import.meta.url)("esbuild");
  const dir = mkdtempSync(join(tmpdir(), "controllo-notte-"));
  let R;
  try {
    const fuori = join(dir, "regole.cjs");
    await esbuild.build({
      entryPoints: [join(radice, "src/crm/controllo-notte/regole.ts")],
      bundle: true,
      format: "cjs",
      platform: "node",
      outfile: fuori,
      logLevel: "error",
      alias: { "@": join(radice, "src") },
    });
    R = createRequire(import.meta.url)(fuori);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  const ORA = 3_600_000;
  const GIORNO = 24 * ORA;
  //  Venerdì 30/10/2026, 06:00 a Roma (05:00 UTC: dal 25/10 è ora solare).
  const VENERDI = new Date("2026-10-30T05:00:00.000Z");
  //  Lunedì 2/11/2026, 06:00 a Roma.
  const LUNEDI = new Date("2026-11-02T05:00:00.000Z");
  const fa = (ms, da = VENERDI) => new Date(da.getTime() - ms).toISOString();

  // ── 1. Che giro è ────────────────────────────────────────────────────────
  gruppo("CONTROLLO DELLA NOTTE · CHE GIRO È");
  c(
    "venerdì: il giro della notte, col giorno di Roma",
    { giorno: "2026-10-30", periodo: "notte" },
    R.giroDi(VENERDI),
  );
  c(
    "lunedì: il giro della settimana",
    { giorno: "2026-11-02", periodo: "settimana" },
    R.giroDi(LUNEDI),
  );
  c(
    "il giorno è quello di Roma, non quello UTC (domenica 23:30 UTC = lunedì a Roma)",
    { giorno: "2026-11-02", periodo: "settimana" },
    R.giroDi(new Date("2026-11-01T23:30:00.000Z")),
  );
  c(
    "notte: si guardano le ultime 24 ore",
    fa(GIORNO),
    R.inizioPeriodo(VENERDI, "notte").toISOString(),
  );
  c(
    "settimana: gli ultimi 7 giorni",
    fa(7 * GIORNO, LUNEDI),
    R.inizioPeriodo(LUNEDI, "settimana").toISOString(),
  );
  c(
    "pulizia della notte: ultime 48 ore (un margine sul giro di ieri)",
    fa(2 * GIORNO),
    R.inizioPulizia(VENERDI, "notte").toISOString(),
  );
  c(
    "pulizia della settimana: ultimi 8 giorni",
    fa(8 * GIORNO, LUNEDI),
    R.inizioPulizia(LUNEDI, "settimana").toISOString(),
  );
  c(
    "la chiave del giorno (una notifica al giorno, anche se il giro parte due volte)",
    "controllo-whatsapp:notte:2026-10-30",
    R.chiaveNotifica(R.giroDi(VENERDI)),
  );

  // ── 2. Gli invii andati male ─────────────────────────────────────────────
  gruppo("CONTROLLO DELLA NOTTE · INVII ANDATI MALE");
  const invii = R.contaInvii([
    { stato: "fallito", motivo: "modello_rifiutato" },
    { stato: "fallito", motivo: "modello_rifiutato" },
    { stato: "fallito", motivo: "da_collegare" },
    { stato: "fallito", motivo: "Errore con +39 333 000 0000 dentro" },
    { stato: "fallito", motivo: null },
    { stato: "incerto", motivo: "prenotato_scaduto" },
    { stato: "inviato", motivo: null },
  ]);
  c("falliti e incerti contati a parte (gli inviati no)", [5, 1], [invii.falliti, invii.incerti]);
  c(
    "i motivi sono codici: uno che non sembra un codice diventa «altro», mai il suo testo",
    { modello_rifiutato: 2, da_collegare: 1, altro: 2 },
    invii.perMotivo,
  );
  c("nessun invio: zero", { falliti: 0, incerti: 0, perMotivo: {} }, R.contaInvii([]));

  // ── 3. La finestra di 24 ore ─────────────────────────────────────────────
  gruppo("CONTROLLO DELLA NOTTE · LA FINESTRA DI 24 ORE");
  const dal = R.inizioPeriodo(VENERDI, "notte");
  const contatto = (entrata, risposto = null, stop = null) => ({
    ultimo_in_entrata_il: entrata,
    risposto_il: risposto,
    non_scrivere_dal: stop,
  });
  const finestra = R.finestra24h(
    [
      contatto(fa(2 * ORA)), //                      aperta, senza risposta
      contatto(fa(20 * ORA), fa(21 * ORA)), //       aperta, risposta PRIMA dell'entrata: aspetta ancora
      contatto(fa(3 * ORA), fa(1 * ORA)), //         aperta ma già risposta
      contatto(fa(30 * ORA)), //                     chiusa ieri senza risposta
      contatto(fa(40 * ORA), fa(39 * ORA)), //       chiusa ma risposta in tempo
      contatto(fa(60 * ORA)), //                     chiusa prima del periodo: non conta
      contatto(fa(5 * ORA), null, fa(4 * ORA)), //   STOP: non si scrive, non conta
      contatto(null), //                             mai scritto
      contatto("data storta"), //                    illeggibile: non conta
    ],
    VENERDI,
    dal,
  );
  c(
    "aperte senza risposta: 2; chiuse senza risposta nel periodo: 1",
    { aperte: 2, scadute: 1 },
    finestra,
  );
  //  Una reazione (anteprima senza testo) non apre una finestra: non è «aperta» né «scaduta».
  c(
    "solo una reazione: né aperta né scaduta; un testo vero sì",
    { aperte: 1, scadute: 0 },
    R.finestra24h(
      [
        { ...contatto(fa(2 * ORA)), ultimo_in_entrata_anteprima: "Reazione, sticker o posizione: aprila in ManyChat" },
        { ...contatto(fa(30 * ORA)), ultimo_in_entrata_anteprima: "[messaggio senza testo]" },
        { ...contatto(fa(2 * ORA)), ultimo_in_entrata_anteprima: "Buongiorno" },
      ],
      VENERDI,
      dal,
    ),
  );
  c(
    "settimana: le chiuse senza risposta di 7 giorni",
    { aperte: 0, scadute: 2 },
    R.finestra24h(
      [
        contatto(fa(2 * GIORNO, LUNEDI)),
        contatto(fa(7.5 * GIORNO, LUNEDI)),
        contatto(fa(9 * GIORNO, LUNEDI)),
      ],
      LUNEDI,
      R.inizioPeriodo(LUNEDI, "settimana"),
    ),
  );
  c(
    "da dove leggere i contatti: un giorno prima dell'inizio del periodo",
    fa(2 * GIORNO),
    R.inizioLetturaContatti(dal).toISOString(),
  );

  // ── 4. Il rapporto ───────────────────────────────────────────────────────
  gruppo("CONTROLLO DELLA NOTTE · IL RAPPORTO");
  const base = {
    giro: R.giroDi(VENERDI),
    adesso: VENERDI,
    nonLetti: [],
    invii: R.contaInvii([]),
    messaggiFalliti: 0,
    pulizia: { eco: 0, doppione: 0, senza_bersaglio: 0, persi: 0 },
    ponte: { stato: "collegato", aggiornato_il: fa(30_000), storico: null },
    manychat: { acceso: true, fermatoDalGiro: false, fallitiDiFila: 0 },
    finestra: { aperte: 0, scadute: 0 },
  };
  const tuttoBene = R.rapportoControllo(base);
  c(
    "tutto in ordine: una riga sola, informativa, niente push",
    ["info", false, 1],
    [tuttoBene.severity, tuttoBene.push, tuttoBene.voci.length],
  );
  c("il titolo lo dice", "Controllo WhatsApp della notte: tutto in ordine", tuttoBene.titolo);
  c("il corpo lo dice", true, /niente da segnalare/i.test(tuttoBene.corpo));

  const brutto = R.rapportoControllo({
    ...base,
    invii: R.contaInvii([
      { stato: "fallito", motivo: "modello_rifiutato" },
      { stato: "fallito", motivo: "da_collegare" },
      { stato: "incerto", motivo: "x" },
    ]),
    messaggiFalliti: 3,
    pulizia: { eco: 2, doppione: 1, senza_bersaglio: 1, persi: 0 },
    ponte: { stato: "collegato", aggiornato_il: fa(7 * ORA), storico: null },
    manychat: { acceso: false, fermatoDalGiro: true, fallitiDiFila: 4 },
    finestra: { aperte: 2, scadute: 1 },
  });
  c("con un problema grave: critical e push", ["critical", true], [brutto.severity, brutto.push]);
  c("i gravi vengono prima", "grave", brutto.voci[0].gravita);
  const testo = brutto.voci.map((v) => v.frase).join(" ");
  c("ponte fermo: lo dice con la durata", true, /non risponde da 7 ore/.test(testo));
  c("ManyChat fermato da solo", true, /ManyChat si è fermato da solo/.test(testo));
  c(
    "invii falliti col conto e i motivi",
    true,
    /2 messaggi automatici non sono partiti/.test(testo) && /modello_rifiutato 1/.test(testo),
  );
  c("invii incerti", true, /1 messaggio automatico non si sa se è partito/.test(testo));
  c(
    "messaggi dalla chat non consegnati",
    true,
    /3 messaggi della chat non sono stati consegnati/.test(testo),
  );
  c(
    "finestra: aperte e chiuse senza risposta",
    true,
    /2 clienti aspettano una risposta/.test(testo) &&
      /1 cliente ha scritto e la finestra di 24 ore si è chiusa/.test(testo),
  );
  c("eco nascoste: segnalate (non dovrebbero più arrivare)", true, /2 eco di ManyChat/.test(testo));
  c(
    "doppioni: detti come sistemati, senza cancellare",
    true,
    /1 doppione nascost/.test(testo) && /non cancellat/.test(testo),
  );
  c(
    "nessun dato dei clienti e nessuna parola tecnica",
    false,
    VIETATE.test(testo + brutto.titolo + brutto.corpo),
  );
  c(
    "il titolo conta le cose da guardare (non le informative)",
    true,
    /\d+ cose da guardare/.test(brutto.titolo),
  );

  const soloInfo = R.rapportoControllo({
    ...base,
    pulizia: { eco: 0, doppione: 3, senza_bersaglio: 0, persi: 0 },
  });
  c(
    "solo doppioni sistemati: informativa, niente push",
    ["info", false],
    [soloInfo.severity, soloInfo.push],
  );
  c("…e il titolo resta «tutto in ordine»", true, /tutto in ordine/.test(soloInfo.titolo));

  const senzaPonte = R.rapportoControllo({ ...base, ponte: null });
  c("chi non ha il ponte: nessuna voce sul ponte", 1, senzaPonte.voci.length);
  const mancaPulizia = R.rapportoControllo({
    ...base,
    pulizia: null,
    nonLetti: ["pulizia", "invii"],
  });
  c(
    "una lettura non riuscita è una cosa da guardare (warning, push)",
    ["warning", true],
    [mancaPulizia.severity, mancaPulizia.push],
  );
  c(
    "…e dice quali, in italiano",
    true,
    /pulizia dei doppioni/.test(mancaPulizia.corpo) &&
      /messaggi automatici/.test(mancaPulizia.corpo),
  );
  const spentoAMano = R.rapportoControllo({
    ...base,
    manychat: { acceso: false, fermatoDalGiro: false, fallitiDiFila: 0 },
  });
  c(
    "ManyChat spento a mano dal titolare: non è un problema",
    ["info", false],
    [spentoAMano.severity, spentoAMano.push],
  );
  const fallitiDiFila = R.rapportoControllo({
    ...base,
    manychat: { acceso: true, fermatoDalGiro: false, fallitiDiFila: 2 },
  });
  c(
    "invii falliti di fila col giro acceso: attenzione",
    ["warning", true],
    [fallitiDiFila.severity, fallitiDiFila.push],
  );

  const settimana = R.rapportoControllo({
    ...base,
    giro: R.giroDi(LUNEDI),
    adesso: LUNEDI,
    ponte: { stato: "collegato", aggiornato_il: fa(30_000, LUNEDI), storico: null },
  });
  c(
    "il lunedì il titolo parla della settimana",
    "Controllo WhatsApp della settimana: tutto in ordine",
    settimana.titolo,
  );

  // ── 5. La notifica push ──────────────────────────────────────────────────
  gruppo("CONTROLLO DELLA NOTTE · LA NOTIFICA SUL TELEFONO");
  const push = R.avvisoPushControllo(brutto);
  c("forma del service worker", ["titolo", "corpo", "chiave", "destinazione"], Object.keys(push));
  c("porta alla pagina delle notifiche", "/CRM/notifiche", push.destinazione);
  c("una notifica che si aggiorna, non una al giorno in pila", "controllo-whatsapp", push.chiave);
  c(
    "sullo schermo bloccato solo il conto, nessun dettaglio",
    true,
    /^\d+ cos[ae] da guardare/.test(push.corpo) && !/ManyChat|clienti|ponte/.test(push.corpo),
  );

  // ── 6. La migrazione ─────────────────────────────────────────────────────
  gruppo("CONTROLLO DELLA NOTTE · LA MIGRAZIONE");
  const cartella = join(radice, "supabase/migrations");
  const nome = readdirSync(cartella).find((n) => /^20261030\d{6}_p8_controllo_notte\.sql$/.test(n));
  c("esiste, col suo timestamp del 30/10", true, !!nome);
  const grezzo = nome ? readFileSync(join(cartella, nome), "utf8") : "";
  const sql = senzaCommenti(grezzo);
  c(
    "solo aggiunte: niente DROP, DELETE, TRUNCATE, ALTER … DROP",
    [],
    ["DROP ", "DELETE ", "TRUNCATE", "ALTER COLUMN"].filter((p) => sql.toUpperCase().includes(p)),
  );
  c(
    "l'unico UPDATE scrive solo duplicato_di",
    true,
    (sql.match(/UPDATE\s+public\.whatsapp_messages\s+SET\s+([^\n]+)/gi) ?? []).every((r) =>
      /SET\s+duplicato_di\s*=/i.test(r),
    ) && /UPDATE\s+public\.whatsapp_messages/i.test(sql),
  );
  c(
    "…e solo su righe ancora libere",
    true,
    /duplicato_di IS NULL/.test(sql.slice(sql.search(/UPDATE\s+public\.whatsapp_messages/i))),
  );
  c(
    "la unique_violation dell'indice dei doppioni è gestita riga per riga",
    true,
    /EXCEPTION\s+WHEN\s+unique_violation/i.test(sql),
  );
  c(
    "le eco solo fra le righe ManyChat (mc-in:), mai del ponte",
    true,
    /LIKE 'mc-in:%'/.test(sql) && /canale IS DISTINCT FROM 'baileys'/.test(sql),
  );
  c(
    "solo il periodo chiesto (p_dal), mai lo storico intero",
    true,
    /created_at >= p_dal/.test(sql),
  );
  c(
    "registro di ogni segno, per poterlo annullare",
    true,
    /CREATE TABLE IF NOT EXISTS public\.wa_pulizia_registro/.test(sql) &&
      /INSERT INTO public\.wa_pulizia_registro/.test(sql),
  );
  c(
    "funzione e registro chiusi a tutti tranne il server",
    [true, true, true],
    [
      /REVOKE ALL ON FUNCTION public\.wa_segna_eco_doppioni\(uuid, timestamptz\) FROM PUBLIC, anon, authenticated/.test(
        sql,
      ),
      /GRANT EXECUTE ON FUNCTION public\.wa_segna_eco_doppioni\(uuid, timestamptz\) TO service_role/.test(
        sql,
      ),
      /REVOKE ALL ON public\.wa_pulizia_registro FROM anon, authenticated/.test(sql),
    ],
  );
  c(
    "il cron ogni mattina con programma_hook_cron",
    true,
    /programma_hook_cron\('controllo-notte-whatsapp', '0 5 \* \* \*', '\/hooks\/controllo-notte'\)/.test(
      sql,
    ),
  );
  c(
    "dice come si spegne e come si annulla",
    true,
    /cron\.unschedule\('controllo-notte-whatsapp'\)/.test(grezzo) &&
      /wa_pulizia_registro/.test(grezzo) &&
      /duplicato_di = NULL/.test(grezzo),
  );
  c("dice che non la lancia la squadra", true, /NON la lancia la squadra/.test(grezzo));

  // ── 7. La rotta ──────────────────────────────────────────────────────────
  //  shortcut: la rotta /hooks/controllo-notte NON è ancora scritta (sessione
  //  interrotta, 30/10). Le sue prove restano qui, pronte: si accendono da sole
  //  quando il file esiste. Finché manca, il cron della migrazione chiama una
  //  rotta che non c'è: la migrazione NON va applicata prima della rotta.
  const fileRotta = join(radice, "src/routes/hooks/controllo-notte.ts");
  if (!existsSync(fileRotta)) {
    gruppo("CONTROLLO DELLA NOTTE · LA ROTTA (DA FARE: file mancante, prove sospese)");
    return;
  }
  gruppo("CONTROLLO DELLA NOTTE · LA ROTTA");
  const rotta = existsSync(fileRotta) ? readFileSync(fileRotta, "utf8") : "";
  c(
    "c'è, col percorso del cron",
    true,
    /createFileRoute\("\/hooks\/controllo-notte"\)/.test(rotta),
  );
  c(
    "la chiave come gli altri hook",
    true,
    /SUPABASE_PUBLISHABLE_KEY/.test(rotta) && /unauthorized/.test(rotta),
  );
  c("chiama la pulizia", true, /rpc\("wa_segna_eco_doppioni"/.test(rotta));
  c(
    "scrive la notifica con la chiave del giorno",
    true,
    /from\("notifications"\)/.test(rotta) && /chiaveNotifica\(/.test(rotta),
  );
  c(
    "push solo se la notifica è nuova e solo ai telefoni del titolare",
    true,
    /rapporto\.push/.test(rotta) &&
      /consulente_id/.test(rotta) &&
      /\.is\("consulente_id", null\)/.test(rotta),
  );
  c(
    "legge il ponte, gli invii, i messaggi falliti, la finestra",
    true,
    [
      "ponte_wa_stato",
      "manychat_invii",
      "manychat_giro",
      "manychat_config",
      "whatsapp_contacts",
      "whatsapp_messages",
    ].every((t) => rotta.includes(`"${t}"`)),
  );
  c(
    "nei log solo codici",
    false,
    /console\.\w+\([^)]*(body|telefono|phone|nome|frase|corpo)/.test(rotta),
  );
  const catalogo = readFileSync(join(radice, "src/crm/notifications/catalogo.ts"), "utf8");
  c(
    "la campanella ha l'etichetta del tipo",
    true,
    /controllo_whatsapp: "Controllo WhatsApp"/.test(catalogo),
  );
}
