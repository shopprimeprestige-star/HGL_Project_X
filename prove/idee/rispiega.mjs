/** ── PROVE: «RISPIEGA CON AI» E LA CASELLA SENZA DETTATURA (30/10/2026) ──────
 *
 *  Commessa 2026-10-30-oggi-e-fatture, ramo feat/chat-rispiega. Due richieste
 *  del titolare, guardando la casella sul telefono:
 *   1. via il microfono DENTRO la casella; la X per cancellare tutto più
 *      evidente e da 44 px (resta il tasto verde a destra, che è un'altra cosa);
 *   2. «Rispiega con AI»: si scelgono la nostra risposta e le domande del
 *      cliente, il Mac scrive una spiegazione più chiara, che va nella casella
 *      come bozza (mai inviata da sola).
 *  Qui: la logica pura (scelta, limiti, lavoro per il Mac), il prompt, la
 *  rotta con porte finte, la migrazione e il sorgente dei componenti.
 *  ⚠️ Dati inventati: nessun numero, nome o testo di clienti veri (il
 *  repository è pubblico).
 *
 *  `mod`: i moduli impacchettati da `prove/prove.mjs`. `aiuti`: { c, gruppo, radice }. */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ID = "11111111-2222-4333-8444-555555555555";
const SEG = "s".repeat(40);
const min = (n) => new Date(Date.UTC(2026, 9, 30, 9, n)).toISOString();
const msg = (id, direction, body, n) => ({ id, direction, body, created_at: min(n) });

export async function proveRispiega(mod, { c, gruppo, radice }) {
  const RI = mod["risposte-ai/rispiega"];
  const R = mod["risposte-ai/regole"];
  const I = mod["risposte-ai/ingresso"];
  const P = await import(join(radice, "strumenti/risposte-ai/src/prompt.mjs"));
  const leggi = (f) => readFileSync(join(radice, f), "utf8");
  const senzaCommenti = (t) =>
    t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

  /* ── LA SCELTA DELLE BOLLE ─────────────────────────────────────────── */
  gruppo("RISPIEGA · COSA SI PUÒ SCEGLIERE");
  c(
    "una bolla di testo, nostra o del cliente",
    [true, true],
    [
      RI.selezionabile(msg("a", "outbound", "Ciao", 0)),
      RI.selezionabile(msg("b", "inbound", "Non ho capito", 1)),
    ],
  );
  c(
    "vuota, spazi o senza testo: no",
    [false, false, false],
    [
      RI.selezionabile(msg("a", "inbound", null, 0)),
      RI.selezionabile(msg("b", "inbound", "  \n", 1)),
      RI.selezionabile(msg("c", "inbound", "[messaggio senza testo]", 2)),
    ],
  );
  c(
    "un modello approvato salvato come «[template:nome]»: no (non è il testo che ha letto il cliente)",
    false,
    RI.selezionabile(msg("a", "outbound", "[template:promemoria_consulenza]", 0)),
  );

  gruppo("RISPIEGA · TOCCARE UNA BOLLA");
  c("un tocco aggiunge in fondo", ["a", "b"], RI.commuta(["a"], "b"));
  c("un secondo tocco la toglie", ["a"], RI.commuta(["a", "b"], "b"));
  const prima = ["a"];
  RI.commuta(prima, "b");
  c("non cambia l'elenco di partenza", ["a"], prima);
  const otto = Array.from({ length: RI.MAX_RISPIEGA }, (_, i) => `m${i}`);
  c("al massimo non se ne aggiungono altre…", otto, RI.commuta(otto, "nuova"));
  c("…ma si può sempre togliere", otto.length - 1, RI.commuta(otto, "m0").length);
  c(
    "il massimo non supera quello che accetta la tabella (8)",
    true,
    RI.MAX_RISPIEGA >= 2 && RI.MAX_RISPIEGA <= 8,
  );

  gruppo("RISPIEGA · LA SCELTA È BUONA?");
  const chat = [
    msg("n1", "outbound", "Buongiorno Mario, la patch si applica in giornata.", 0),
    msg("c1", "inbound", "Non ho capito cosa intende", 1),
    msg("n2", "outbound", "Dura circa due ore.", 2),
    msg("c2", "inbound", "Ok e dopo?", 3),
    msg("v", "inbound", null, 4),
  ];
  let k = RI.controllaScelta(["n1"], chat);
  c("la sola nostra risposta basta", [true, ["n1"]], [k.ok, k.ids]);
  k = RI.controllaScelta(["c2", "n1", "c1"], [...chat].reverse());
  c(
    "nostra e domande: in ordine di chat, qualunque sia l'ordine dei tocchi",
    [true, ["n1", "c1", "c2"]],
    [k.ok, k.ids],
  );
  c("niente scelto: «vuota»", { ok: false, motivo: "vuota" }, RI.controllaScelta([], chat));
  c(
    "solo domande del cliente: serve almeno una nostra risposta",
    { ok: false, motivo: "senza_nostro" },
    RI.controllaScelta(["c1", "c2"], chat),
  );
  c(
    "un id che non c'è più: «mancanti»",
    { ok: false, motivo: "mancanti" },
    RI.controllaScelta(["n1", "zzz"], chat),
  );
  c(
    "una bolla senza testo: «mancanti»",
    { ok: false, motivo: "mancanti" },
    RI.controllaScelta(["n1", "v"], chat),
  );
  const tante = Array.from({ length: RI.MAX_RISPIEGA + 1 }, (_, i) =>
    msg(`t${i}`, "outbound", `Testo ${i}`, i),
  );
  c(
    "più del massimo: «troppi»",
    { ok: false, motivo: "troppi" },
    RI.controllaScelta(
      tante.map((m) => m.id),
      tante,
    ),
  );
  const lunghe = [
    msg("l1", "outbound", "x".repeat(2500), 0),
    msg("l2", "inbound", "y".repeat(2500), 1),
  ];
  c(
    "troppo testo in tutto: «troppo_testo»",
    { ok: false, motivo: "troppo_testo" },
    RI.controllaScelta(["l1", "l2"], lunghe),
  );
  c(
    "…il tetto è quello dichiarato",
    true,
    RI.CARATTERI_MAX_RISPIEGA >= 1000 && RI.CARATTERI_MAX_RISPIEGA <= 8000,
  );
  c(
    "ogni motivo ha una frase in italiano",
    true,
    ["vuota", "senza_nostro", "mancanti", "troppi", "troppo_testo"].every(
      (m) => RI.fraseControllo(m).length > 15 && !/undefined/.test(RI.fraseControllo(m)),
    ),
  );
  c(
    "…che dice il massimo vero",
    true,
    RI.fraseControllo("troppi").includes(String(RI.MAX_RISPIEGA)),
  );

  /* ── IL LAVORO PER IL MAC ──────────────────────────────────────────── */
  gruppo("RISPIEGA · COSA ARRIVA AL MAC");
  const lead = {
    nome: "Mario",
    cognome: "Esempio",
    telefono: "3331234567",
    email: "mario@esempio.test",
    note: "Nota riservata",
    stato: "attesa_whatsapp",
    dataMeeting: "2026-11-02",
  };
  const chatCompleta = [msg("old", "inbound", "Messaggio non scelto, vecchio", -5), ...chat];
  let e = RI.lavoroRispiega({
    id: ID,
    scelti: ["c1", "n1"],
    messaggi: [...chatCompleta].reverse(),
    lead,
  });
  c(
    "solo i messaggi scelti, in ordine di chat",
    [
      ["noi", "cliente"],
      ["Buongiorno Mario, la patch si applica in giornata.", "Non ho capito cosa intende"],
    ],
    [e.lavoro.messaggi.map((m) => m.chi), e.lavoro.messaggi.map((m) => m.testo)],
  );
  c("il modo c'è e si chiama «rispiega»", ["rispiega", ID], [e.lavoro.modo, e.lavoro.id]);
  c("della scheda solo il nome", "Mario", e.lavoro.nome);
  const json = JSON.stringify(e);
  c(
    "niente telefono, email, note, stato, cognome né data nel lavoro",
    false,
    /3331234567|esempio\.test|Nota riservata|attesa|Esempio|2026-11-02/.test(json),
  );
  c("niente messaggi non scelti", false, /non scelto|Dura circa|Ok e dopo/.test(json));
  c(
    "nessun ora né id dei messaggi: bastano chi e testo",
    [["chi", "testo"]],
    [Object.keys(e.lavoro.messaggi[0]).sort()],
  );
  e = RI.lavoroRispiega({ id: ID, scelti: ["n1"], messaggi: chat, lead: null });
  c("senza scheda il nome è vuoto", "", e.lavoro.nome);
  c(
    "solo domande del cliente: errore «senza_nostro»",
    { errore: "senza_nostro" },
    RI.lavoroRispiega({ id: ID, scelti: ["c1"], messaggi: chat }),
  );
  c(
    "scelti spariti: errore «messaggi_mancanti»",
    { errore: "messaggi_mancanti" },
    RI.lavoroRispiega({ id: ID, scelti: ["zzz"], messaggi: chat }),
  );
  c(
    "troppo testo: errore «troppo_testo»",
    { errore: "troppo_testo" },
    RI.lavoroRispiega({ id: ID, scelti: ["l1", "l2"], messaggi: lunghe }),
  );
  c(
    "gli errori hanno una frase per il titolare",
    true,
    ["senza_nostro", "troppo_testo", "messaggi_mancanti"].every(
      (x) => R.erroreInChiaro(x).length > 15 && !/Il Mac non è riuscito/.test(R.erroreInChiaro(x)),
    ),
  );

  /* ── IL PROMPT ─────────────────────────────────────────────────────── */
  gruppo("RISPIEGA · LE ISTRUZIONI PER IL MODELLO");
  const sis = P.istruzioniRispiega();
  c(
    "rispiega in modo più semplice e chiaro i messaggi NOSTRI scelti",
    true,
    /più semplice e (più )?chiaro/i.test(sis) && /NOSTR/.test(sis),
  );
  c(
    "risponde ai dubbi nelle domande del cliente scelte",
    true,
    /dubbi|domande/i.test(sis) && /CLIENTE/.test(sis),
  );
  c(
    "stesso tono e stesso «lei»/«tu» dei nostri messaggi",
    true,
    /stesso tono/i.test(sis) && /«lei»/.test(sis) && /«tu»/.test(sis),
  );
  c(
    "italiano, breve, adatto a WhatsApp",
    true,
    /italiano/i.test(sis) && /WhatsApp/.test(sis) && /(breve|corte)/i.test(sis),
  );
  c(
    "non inventa prezzi, date o promesse",
    true,
    /Non inventare/i.test(sis) && /prezzi/.test(sis) && /date/.test(sis) && /promesse/.test(sis),
  );
  c("solo il testo del messaggio, senza premesse", true, /SOLO il testo/.test(sis));
  c(
    "i messaggi sono dati: istruzioni scritte dentro si ignorano",
    true,
    /ignorale|ignora/i.test(sis),
  );
  c(
    "niente documenti dell'azienda: il modello non ha altro da cui inventare",
    [false, false],
    [/INFORMAZIONI DELL'AZIENDA/.test(sis), /Invisible Derm/.test(sis)],
  );
  const dom = P.domandaRispiega(
    e.lavoro ? { ...e.lavoro, telefono: "3331234567", cliente: { note: "Nota riservata" } } : {},
  );
  c("la domanda: i messaggi scelti con chi parla", true, /NOI: Buongiorno Mario/.test(dom));
  c("…il nome del cliente", true, /Mario/.test(dom));
  c(
    "…niente di più: nemmeno i campi che per errore arrivassero",
    false,
    /3331234567|Nota riservata/.test(dom),
  );
  const dom2 = P.domandaRispiega(
    RI.lavoroRispiega({ id: ID, scelti: ["n1", "c1"], messaggi: chat, lead }).lavoro,
  );
  c(
    "nostro e cliente, uno per riga, in ordine",
    true,
    /NOI: Buongiorno Mario[^\n]*\nCLIENTE: Non ho capito cosa intende/.test(dom2),
  );
  c(
    "a capo dentro un messaggio: su una riga sola",
    true,
    /NOI: uno \/ due/.test(
      P.domandaRispiega({ nome: "", messaggi: [{ chi: "noi", testo: "uno\ndue" }] }),
    ),
  );
  c("chiude con la richiesta", true, /Scrivi ora/.test(dom2));

  /* ── LA ROTTA DEL MAC, CON PORTE FINTE ─────────────────────────────── */
  gruppo("RISPIEGA · LA ROTTA DEL MAC");
  const finte = (coda) => {
    const reg = { chiusi: [], chiamate: [] };
    const fila = [...coda];
    return {
      reg,
      porte: {
        avviso: () => {},
        utente: async () => "U1",
        battito: async () => {},
        prendi: async () => fila.shift() ?? null,
        bozza: async () => null,
        messaggiChat: async (u, t, scelti, soloScelti) => {
          reg.chiamate.push({ scelti, soloScelti });
          return chatCompleta;
        },
        scheda: async () => ({ lead, consulente: "Luca" }),
        chiudi: async (u, id, es) => {
          reg.chiusi.push([id, es]);
          return true;
        },
      },
    };
  };
  const esegui = async (f, corpo) => {
    const r = await I.gestisciRisposteAi(f.porte, {
      request: new Request("https://x/api/public/risposte-ai", {
        method: "POST",
        headers: { "x-hgl-token": SEG },
        body: JSON.stringify(corpo),
      }),
      segreto: SEG,
    });
    return { stato: r.status, corpo: await r.json() };
  };
  let f = finte([
    {
      id: ID,
      telefono: "+393331234567",
      messaggi: ["n1", "c1"],
      indicazione: "ignorata",
      orari: "oggi 15:00",
      modo: "rispiega",
    },
  ]);
  let r = await esegui(f, { azione: "prendi" });
  c(
    "richiesta «rispiega»: il lavoro è quello di rispiega",
    ["rispiega", 2],
    [r.corpo.lavoro.modo, r.corpo.lavoro.messaggi.length],
  );
  c(
    "…si leggono solo i messaggi scelti",
    [{ scelti: ["n1", "c1"], soloScelti: true }],
    f.reg.chiamate,
  );
  c(
    "…niente numero, email, note, orari né indicazione nel lavoro",
    false,
    /3331234567|esempio\.test|Nota riservata|oggi 15:00|ignorata|Luca/.test(
      JSON.stringify(r.corpo),
    ),
  );
  f = finte([
    { id: ID, telefono: "+39333", messaggi: ["c1"], indicazione: null, modo: "rispiega" },
    {
      id: "2" + ID.slice(1),
      telefono: "+39333",
      messaggi: ["n1"],
      indicazione: null,
      modo: "rispiega",
    },
  ]);
  r = await esegui(f, { azione: "prendi" });
  c(
    "senza una nostra risposta: chiusa con errore e si passa alla successiva",
    [[ID, { errore: "senza_nostro" }], "2" + ID.slice(1)],
    [f.reg.chiusi[0], r.corpo.lavoro.id],
  );
  f = finte([{ id: ID, telefono: "+39333", messaggi: ["c1"], indicazione: null }]);
  r = await esegui(f, { azione: "prendi" });
  c(
    "richiesta senza modo (come prima): resta «rispondi con AI»",
    [undefined, true, [{ scelti: ["c1"], soloScelti: undefined }]],
    [r.corpo.lavoro.modo, Array.isArray(r.corpo.lavoro.messaggi), f.reg.chiamate],
  );

  /* ── LA MIGRAZIONE (solo scritta, non lanciata) ────────────────────── */
  gruppo("RISPIEGA · LA MIGRAZIONE");
  const nomi = readdirSync(join(radice, "supabase/migrations")).filter((n) => /rispiega/.test(n));
  c("c'è un solo file di migrazione per «rispiega»", 1, nomi.length);
  const sql = nomi[0]
    ? senzaCommenti(leggi(`supabase/migrations/${nomi[0]}`).replace(/--[^\n]*/g, ""))
    : "";
  c(
    "aggiunge la colonna `modo` con 'rispondi' di partenza e due soli valori",
    true,
    /ADD COLUMN IF NOT EXISTS modo text NOT NULL DEFAULT 'rispondi'/.test(sql) &&
      /CHECK \(modo IN \('rispondi', 'rispiega'\)\)/.test(sql),
  );
  c(
    "solo aggiunte: niente DROP, DELETE, UPDATE né TRUNCATE",
    false,
    /\b(DROP|DELETE|UPDATE|TRUNCATE)\b/i.test(sql),
  );
  c(
    "il nome è il più recente fra le migrazioni",
    true,
    readdirSync(join(radice, "supabase/migrations"))
      .filter((n) => n.endsWith(".sql") && !n.includes("eco_entrata_contatti") && !n.includes("ponte_revoche") && !n.includes("ponte_media")) // l'eco sul contatto (eco-manychat-entrata), le revoche (ponte-revoche) e i media (media-e-archiviazione) vengono dopo: hanno il loro ordine
      .sort()
      .at(-1) === nomi[0],
  );

  /* ── IL CLIENTE: HOOK E COMPONENTI ─────────────────────────────────── */
  gruppo("RISPIEGA · IL SORGENTE DEL CRM");
  const hook = senzaCommenti(leggi("src/crm/chatwa/useRispostaAi.ts"));
  c(
    "l'hook chiede il modo «rispiega» solo quando si rispiega",
    true,
    /modo:\s*"rispiega"/.test(hook) && /controllaScelta\(/.test(hook),
  );
  c(
    "…senza la colonna dice cosa fare, non prova senza (la richiesta sarebbe un'altra)",
    true,
    /colonnaMancante\(error\)/.test(hook) &&
      /migrazione/.test(leggi("src/crm/chatwa/useRispostaAi.ts")),
  );
  c(
    "…la bozza va nella casella con la stessa strada di «Rispondi con AI»",
    true,
    /p\.onRisposta\(/.test(hook),
  );
  c(
    "…mai invia: nessuna chiamata a invia/inviaWhatsapp",
    false,
    /invia\(|inviaWhatsapp|whatsapp-send/.test(hook),
  );
  c(
    "…la richiesta di rispiega non porta orari né indicazione",
    true,
    /indicazione:\s*rispiega \? null/.test(hook) && /const orari = rispiega \? null/.test(hook),
  );
  const barra = senzaCommenti(leggi("src/crm/chatwa/BarraRispiega.tsx"));
  c(
    "la barra: «Rispiega con AI» e «Annulla»",
    true,
    /Rispiega con AI/.test(barra) && /Annulla/.test(barra),
  );
  c("…il numero di bolle selezionate", true, /selezionat/.test(barra));
  c("…tasti da 44 px sul telefono", true, (barra.match(/h-11/g) ?? []).length >= 2);
  c("…stato «sto scrivendo»", true, /Sto scrivendo/.test(barra) && /animate-spin/.test(barra));
  c(
    "…il doppio clic è bloccato (disabilitato mentre aspetta)",
    true,
    /disabled=\{[^}]*attesa[^}]*\}/.test(barra),
  );
  c("…l'errore si legge (role=alert)", true, /role="alert"/.test(barra));
  const bolla = senzaCommenti(leggi("src/crm/chatwa/BollaMessaggio.tsx"));
  c(
    "la bolla: pressione lunga con gli eventi del puntatore, come le righe dell'elenco",
    true,
    /PRESSIONE_LUNGA_MS/.test(bolla) &&
      /eSpostamento\(/.test(bolla) &&
      /onPointerDown=/.test(bolla) &&
      /onPointerCancel=/.test(bolla),
  );
  c(
    "…e la voce «Rispiega con AI» nel menu della bolla (per il computer)",
    true,
    /Rispiega con AI/.test(bolla) && /DropdownMenu/.test(bolla),
  );
  c(
    "…il menu della bolla si apre anche da tastiera (è un bottone)",
    true,
    /<DropdownMenuTrigger asChild>\s*<button/.test(bolla),
  );
  const conv = senzaCommenti(leggi("src/crm/chatwa/Conversazione.tsx"));
  c(
    "la conversazione: usa la barra della rispiega al posto della casella",
    true,
    /BarraRispiega/.test(conv) && /ai\.modo === "rispiega"/.test(conv),
  );
  c(
    "…e riconosce il rilascio dopo la pressione lunga (non deseleziona la bolla appena scelta)",
    true,
    /lungo\.current/.test(conv),
  );
  c(
    "…nelle bolle da scegliere in rispiega ci sono anche le nostre e quelle del cliente",
    true,
    /selezionabile\(/.test(conv),
  );

  /* ── LA CASELLA: SENZA DETTATURA IN CASELLA, X NUOVA ───────────────── */
  gruppo("CASELLA · NIENTE MICROFONO DENTRO, LA X NUOVA");
  const casellaTutta = leggi("src/crm/chatwa/Casella.tsx");
  const casella = senzaCommenti(casellaTutta);
  c(
    "il microfono dentro la casella non c'è più: resta un solo TastoMicrofono, quello verde grande",
    [1, true],
    [
      (casella.match(/<TastoMicrofono/g) ?? []).length,
      /<TastoMicrofono d=\{dettatura\} grande \/>/.test(casella),
    ],
  );
  c(
    "…il tasto verde a destra (casella vuota) c'è ancora",
    true,
    /!bozza\.trim\(\) && dettaturaPossibile/.test(casella),
  );
  c("la X: ancora solo con del testo", true, /bozza !== "" && configurata/.test(casella));
  const x = casella.slice(
    casella.indexOf('aria-label="Svuota il messaggio"') - 700,
    casella.indexOf('aria-label="Svuota il messaggio"') + 900,
  );
  c(
    "…area di tocco di 44×44 px (h-11 w-11) e misure fisse",
    true,
    /h-11 w-11/.test(x) && /shrink-0/.test(x),
  );
  c(
    "…il pointerdown non toglie il fuoco (preventDefault): la tastiera resta",
    true,
    /onPointerDown=\{\(e\) => e\.preventDefault\(\)\}/.test(x),
  );
  c(
    "…e anche il mousedown, per i browser che lo mandano lo stesso",
    true,
    /onMouseDown=\{\(e\) => e\.preventDefault\(\)\}/.test(x),
  );
  c(
    "…un cerchio pieno con la X dentro (non più l'icona nuda da 18 px)",
    true,
    /rounded-full bg-muted-foreground/.test(x) && /<X /.test(x) && !/h-\[18px\] w-\[18px\]/.test(x),
  );
  c(
    "…etichetta per chi non vede, e svuota davvero",
    true,
    /aria-label="Svuota il messaggio"/.test(x) && /onClick=\{svuota\}/.test(x),
  );
  c(
    "…l'«Annulla» dopo aver cancellato c'è ancora",
    true,
    /bozzaDopoAnnulla\(/.test(casella) && /Messaggio cancellato/.test(casella),
  );
  c(
    "dettatura.ts resta: lo usano ancora il registratore verde, le note vocali e la rotta",
    true,
    existsSync(join(radice, "src/crm/chatwa/dettatura.ts")) &&
      /from "\.\/dettatura"/.test(leggi("src/crm/chatwa/RegistratoreVoce.tsx")) &&
      /chatwa\/dettatura/.test(leggi("src/routes/api.crm.dettatura.ts")) &&
      /useDettatura/.test(leggi("src/crm/NotaVocale.tsx")),
  );
}
