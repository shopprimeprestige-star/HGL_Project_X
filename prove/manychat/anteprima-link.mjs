import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { creaFinto, creaOrologio, esiti, PERCORSI } from "./finto.mjs";

/** ── PROVE: L'ANTEPRIMA DEI LINK NEI MESSAGGI MANUALI (31/10/2026) ──────────
 *
 *  Commessa 2026-10-31-anteprima-link. Un testo libero scritto a mano nella chat del CRM che
 *  contiene un link parte con la Cloud API di Meta (`preview_url: true`), così su WhatsApp compare
 *  l'anteprima; ManyChat non la sa fare. SOLO a queste condizioni: la rotta della chat dichiara il
 *  messaggio con `anteprimaLink`, c'è un link http(s), l'interruttore è acceso e le chiavi Meta
 *  ci sono, la finestra di 24 ore è aperta. In ogni altro caso, ManyChat come prima.
 *
 *  Il ripiego: un rifiuto DEFINITIVO di Meta (4xx: non è partito niente) rimanda via ManyChat; un
 *  esito incerto (rete, timeout, 5xx, risposta senza id) NON si rimanda: sarebbe un doppio invio.
 *
 *  Dati inventati: nessun numero né chiave veri. `mod`: moduli impacchettati; `aiuti`: { c, gruppo, radice }. */

const NUMERO = "393331234567";
const TOKEN_FINTO = "EAAG-TOKEN-FINTO-9f8e7d6c5b4a";
const PHONE_ID_FINTO = "109876543210987";
const TESTO = "Ecco la pagina: https://hair-genius-hub.hair/media/abc123 a presto";
const BASE = Date.parse("2026-10-31T10:00:00+01:00");
const iso = (s) => new Date(s * 1000).toISOString();

export async function proveAnteprimaLink(mod, { c, gruppo, radice }) {
  const P = mod["manychat/porta"];
  const A = mod["manychat/api"];
  const PARI = mod["ponte/pari"];
  const TIPI = mod["ponte/tipi"];

  gruppo("ANTEPRIMA LINK · MESSAGGI MANUALI CON LINK VIA CLOUD");

  const nuovoFinto = () =>
    creaFinto().su(
      "GET",
      PERCORSI.campi,
      esiti.successo([{ id: 501, name: "crm_telefono", type: "text" }]),
    );

  /** Le porte: ManyChat finto, Cloud finta (copione di risposte), interruttore+chiavi a scelta. */
  function creaPorte(o = {}) {
    const f = nuovoFinto();
    const orologio = f.orologio;
    const cloud = [];
    const messaggi = [];
    const avvisi = [];
    const risposte = [...(o.cloud ?? [])];
    const entrata =
      o.ultimaEntrata === undefined
        ? new Date(orologio.ms - 3600_000).toISOString()
        : o.ultimaEntrata;
    const porte = {
      adesso: () => orologio.adesso(),
      interruttore: async () => true,
      client: () => A.creaClient({ chiave: "chiave-finta-0000", fetch: f.fetch, timeoutMs: 25 }),
      flusso: async () => null,
      prenota: async () => ({ id: "inv1" }),
      esito: async () => undefined,
      subscriberNoto: async () => 1000001,
      registra: async (m) => void messaggi.push(m),
      avviso: (codice) => void avvisi.push(codice),
      //  Il token e il phone_number_id stanno SOLO dentro la porta Cloud: la porta unica non li vede mai.
      cloud: async (corpo) => {
        cloud.push({ corpo, token: TOKEN_FINTO, phoneNumberId: PHONE_ID_FINTO });
        const r = risposte.shift() ?? {
          status: 200,
          corpo: { messages: [{ id: "wamid.HBgM-FINTO-1" }] },
        };
        if (r === "rete") throw new TypeError("fetch failed");
        return r;
      },
      ...(o.senzaFinestra
        ? {}
        : {
            ultimaEntrata: async () =>
              o.finestraGuasta ? Promise.reject(new Error("db")) : entrata,
          }),
      ...(o.senzaPortaAnteprima
        ? {}
        : {
            anteprimaLink: async () => {
              if (o.interruttoreGuasto) throw new Error("db giù");
              return o.anteprima ?? true;
            },
          }),
    };
    return { porte, f, cloud, messaggi, avvisi };
  }
  const manuale = {
    canale: "manychat",
    a: `+${NUMERO}`,
    testo: TESTO,
    tipo: "chat",
    messaggio: "manuale",
    leadId: null,
    anteprimaLink: true,
  };
  const percorsiManychat = (x) => x.f.chiamate.map((q) => q.percorso);

  /* ── 1. IL CASO BUONO ─────────────────────────────────────────────────── */
  {
    const x = creaPorte();
    const r = await P.inviaWhatsapp(x.porte, manuale);
    c("link + chiavi + interruttore + finestra aperta: esito ok", "ok", r.esito);
    c(
      "…parte UNA volta sola dalla Cloud, testo con preview_url true",
      [1, true, TESTO, NUMERO],
      [
        x.cloud.length,
        x.cloud[0]?.corpo.text?.preview_url,
        x.cloud[0]?.corpo.text?.body,
        x.cloud[0]?.corpo.to,
      ],
    );
    c("…e non si tocca ManyChat (nessuna chiamata)", [], percorsiManychat(x));
    c("…l'id del messaggio è quello di Meta", "wamid.HBgM-FINTO-1", r.waId);
    c(
      "…la riga in archivio: canale cloud, id di Meta, inviato, col testo vero",
      [1, "cloud", "wamid.HBgM-FINTO-1", "sent", TESTO, `+${NUMERO}`, null],
      [
        x.messaggi.length,
        x.messaggi[0]?.canale,
        x.messaggi[0]?.waId,
        x.messaggi[0]?.stato,
        x.messaggi[0]?.corpo,
        x.messaggi[0]?.a,
        x.messaggi[0]?.errore,
      ],
    );
    const ris = P.rispostaChat(r);
    c(
      "…la chat riceve ok col waMessageId di Meta (senza «mc:»)",
      [200, { ok: true, waMessageId: "wamid.HBgM-FINTO-1" }],
      [ris.status, ris.corpo],
    );

    //  L'eco del ponte (Baileys) e la deduplica: la riga Cloud ha il cliente in to_number, canale cloud, non failed.
    const m = x.messaggi[0];
    const rigaCrm = {
      id: "crm1",
      direction: "outbound",
      from_number: "cloud",
      to_number: m.a,
      body: m.corpo,
      canale: m.canale,
      status: m.stato,
      duplicato_di: null,
      created_at: iso(BASE / 1000),
    };
    const rigaPonte = {
      k: TIPI.chiaveMessaggio(NUMERO, "ABC"),
      n: NUMERO,
      d: "out",
      t: BASE / 1000 + 2,
      x: TESTO,
      m: null,
    };
    const richiesta = { k: rigaPonte.k, n: rigaPonte.n, d: rigaPonte.d, t: rigaPonte.t };
    const ammessa = PARI.ammessoCome(rigaCrm, richiesta);
    const pari = ammessa
      ? PARI.abbinaPari(
          [rigaPonte],
          [
            {
              k: rigaPonte.k,
              id: rigaCrm.id,
              created_at: rigaCrm.created_at,
              direction: "outbound",
              body: rigaCrm.body,
              canale: rigaCrm.canale,
            },
          ],
        )
      : [];
    c(
      "l'eco del ponte (stesso testo, 2 s dopo) fa da pari alla riga Cloud: nessun doppione",
      ["crm1"],
      pari.map((p) => p.crm),
    );
    const rigaPonteLontana = { ...rigaPonte, t: BASE / 1000 + 600 };
    c(
      "…un messaggio uguale mandato dopo 10 minuti NON viene nascosto",
      false,
      PARI.ammessoCome(rigaCrm, {
        k: rigaPonteLontana.k,
        n: NUMERO,
        d: "out",
        t: rigaPonteLontana.t,
      }),
    );
  }

  /* ── 2. SENZA LINK, SENZA I PRESUPPOSTI: MANYCHAT COME OGGI ─────────── */
  const comeOggi = async (nome, o, richiesta) => {
    const x = creaPorte(o);
    const r = await P.inviaWhatsapp(x.porte, { ...manuale, ...richiesta });
    c(
      `${nome}: ManyChat (sendContent), la Cloud non si chiama`,
      ["ok", 0, true],
      [r.esito, x.cloud.length, percorsiManychat(x).includes(PERCORSI.testo)],
    );
    c(
      `${nome}: la riga in archivio è quella di ManyChat di sempre (nessun canale cloud)`,
      [1, true],
      [
        x.messaggi.length,
        x.messaggi[0]?.canale !== "cloud" && /^mc:/.test(x.messaggi[0]?.waId ?? ""),
      ],
    );
    return x;
  };
  await comeOggi("senza link", {}, { testo: "Ci vediamo domani alle 10" });
  await comeOggi(
    "un testo che parla di http ma senza indirizzo",
    {},
    { testo: "scrivo http: ma niente indirizzo" },
  );
  await comeOggi("interruttore spento o chiavi assenti", { anteprima: false });
  await comeOggi("porta dell'interruttore assente", { senzaPortaAnteprima: true });
  await comeOggi("controllo dell'interruttore guasto (nel dubbio, ManyChat)", {
    interruttoreGuasto: true,
  });
  await comeOggi(
    "chi chiama non ha dichiarato l'anteprima (giro, pannello, webinar…)",
    {},
    { anteprimaLink: undefined },
  );
  await comeOggi("finestra di 24 ore chiusa", {
    ultimaEntrata: new Date(BASE - 30 * 3600_000).toISOString(),
  });
  await comeOggi("nessuna entrata del cliente", { ultimaEntrata: null });
  await comeOggi("porta della finestra assente", { senzaFinestra: true });
  await comeOggi("porta della finestra guasta", { finestraGuasta: true });

  /* ── 3. L'ERRORE DEFINITIVO DI META: RIPIEGO, SENZA DOPPIO INVIO ────── */
  for (const [nome, risposta, codice] of [
    [
      "token scaduto (190)",
      { status: 401, corpo: { error: { code: 190, message: "segreto non in log" } } },
      "anteprima_ripiego_190",
    ],
    [
      "fuori finestra per Meta (131047)",
      { status: 400, corpo: { error: { code: 131047 } } },
      "anteprima_ripiego_131047",
    ],
    [
      "numero di test, destinatario non ammesso (131030)",
      { status: 400, corpo: { error: { code: 131030 } } },
      "anteprima_ripiego_131030",
    ],
    [
      "limite di Meta (429)",
      { status: 429, corpo: { error: { code: 80007 } } },
      "anteprima_ripiego_80007",
    ],
    ["rifiuto senza codice (400)", { status: 400, corpo: null }, "anteprima_ripiego_400"],
  ]) {
    const x = creaPorte({ cloud: [risposta] });
    const r = await P.inviaWhatsapp(x.porte, manuale);
    c(
      `${nome}: una sola chiamata a Meta, una sola a ManyChat (sendContent), esito ok`,
      ["ok", 1, 1],
      [r.esito, x.cloud.length, percorsiManychat(x).filter((p) => p === PERCORSI.testo).length],
    );
    c(
      `${nome}: una sola riga in archivio, di ManyChat; il registro dice il codice del ripiego`,
      [1, true, [codice]],
      [x.messaggi.length, /^mc:/.test(x.messaggi[0]?.waId ?? ""), x.avvisi],
    );
  }

  /* ── 4. L'ESITO INCERTO: NIENTE RIPIEGO, NIENTE DOPPIO INVIO ────────── */
  for (const [nome, risposta] of [
    ["rete giù o timeout", "rete"],
    ["errore 500 di Meta", { status: 500, corpo: { error: { code: 2 } } }],
    ["503 di Meta", { status: 503, corpo: null }],
    ["200 senza l'id del messaggio", { status: 200, corpo: {} }],
    ["200 con un corpo illeggibile", { status: 200, corpo: null }],
  ]) {
    const x = creaPorte({ cloud: [risposta] });
    const r = await P.inviaWhatsapp(x.porte, manuale);
    c(
      `${nome}: esito incerto, ManyChat NON viene chiamato`,
      ["incerto", 1, []],
      [r.esito, x.cloud.length, percorsiManychat(x)],
    );
    c(
      `${nome}: la riga resta «in coda» con l'avviso, così si vede e il ponte la riconosce`,
      [1, "cloud", "queued", TESTO, "esito incerto", null],
      [
        x.messaggi.length,
        x.messaggi[0]?.canale,
        x.messaggi[0]?.stato,
        x.messaggi[0]?.corpo,
        x.messaggi[0]?.errore,
        x.messaggi[0]?.waId,
      ],
    );
    const ris = P.rispostaChat(r);
    c(
      `${nome}: alla chat 504 che dice di controllare in WhatsApp`,
      [504, "esito_incerto", true],
      [ris.status, ris.corpo.error, /WhatsApp/.test(String(ris.corpo.message))],
    );
  }

  /* ── 5. I MESSAGGI AUTOMATICI E I MODELLI NON CAMBIANO ───────────────── */
  {
    //  Un messaggio automatico (chiave del catalogo) con un link, anche se qualcuno dichiara l'anteprima.
    const a = creaPorte();
    const ra = await P.inviaWhatsapp(a.porte, { ...manuale, messaggio: "conferma_consulenza" });
    c(
      "messaggio automatico con link: ManyChat, mai la Cloud",
      ["ok", 0],
      [ra.esito, a.cloud.length],
    );
    //  Un modello con parametri col link (promemoria, giro): il modello, non il testo.
    const m = creaPorte();
    const rm = await P.inviaWhatsapp(m.porte, {
      ...manuale,
      testo: undefined,
      modello: "consulenza_conferma_presenza",
      parametri: ["Maria", "domani", "10:00", "https://esempio.test/stanza?chi=p1"],
      messaggio: "conferma_consulenza",
    });
    c("modello con link nei parametri: la Cloud non si chiama", 0, m.cloud.length);
    void rm;
    //  Anche un modello dichiarato «manuale» (pannello, prova modelli) non passa dall'anteprima.
    const n = creaPorte();
    await P.inviaWhatsapp(n.porte, {
      ...manuale,
      testo: undefined,
      modello: "consulenza_conferma_presenza",
      parametri: ["a", "b", "c", "https://x.it/y"],
    });
    c("modello a mano con link: la Cloud non si chiama", 0, n.cloud.length);
    //  Il canale cloud di sempre non passa da qui.
    const k = creaPorte();
    const rk = await P.inviaWhatsapp(k.porte, { ...manuale, canale: "cloud" });
    c(
      "canale cloud storico: un solo invio Cloud, nessuna riga scritta dalla porta, nessun avviso",
      [1, 0, []],
      [k.cloud.length, k.messaggi.length, k.avvisi],
    );
    void rk;
  }

  /* ── 6. NESSUNA CHIAVE NEI LOG, NELLE RIGHE, NEI RISULTATI ───────────── */
  {
    const segreti = [TOKEN_FINTO, PHONE_ID_FINTO];
    const raccolta = [];
    for (const risposta of [
      undefined,
      { status: 401, corpo: { error: { code: 190 } } },
      "rete",
      { status: 500, corpo: null },
    ]) {
      const x = creaPorte({ cloud: risposta === undefined ? [] : [risposta] });
      const r = await P.inviaWhatsapp(x.porte, manuale);
      raccolta.push(
        JSON.stringify([r, P.rispostaChat(r), x.messaggi, x.avvisi, percorsiManychat(x)]),
      );
    }
    const dentro = segreti.some((s) => raccolta.some((t) => t.includes(s)));
    c(
      "risultato, risposta alla chat, righe in archivio e avvisi: nessun token né phone_number_id",
      false,
      dentro,
    );
    const sorgente = readFileSync(join(radice, "src/crm/manychat/porta.ts"), "utf8");
    c(
      "porta.ts non nomina il token né lo legge (le chiavi vivono solo nella porta Cloud)",
      false,
      /access_token|accessToken|Authorization/.test(sorgente),
    );
  }

  /* ── 7. IL COLLEGAMENTO CON IL MONDO (lettura del sorgente) ───────────── */
  {
    const server = readFileSync(join(radice, "src/crm/manychat/porta.server.ts"), "utf8");
    const rotta = readFileSync(join(radice, "src/routes/api.whatsapp-send.ts"), "utf8");
    const pannello = readFileSync(join(radice, "src/routes/api.crm.anteprima-link.ts"), "utf8");
    c(
      "porta.server: l'interruttore è una riga di app_config, spenta di serie, e vale solo con le chiavi presenti",
      [true, true, true],
      [
        /CHIAVE_ANTEPRIMA_LINK/.test(server) && /interruttoreAcceso\(/.test(server),
        /anteprimaLink:/.test(server),
        /sandbox/.test(server),
      ],
    );
    c(
      "porta.server: l'archivio scrive il canale della riga (cloud o manychat)",
      [true, true],
      [
        /canale: m\.canale \?\? "manychat"/.test(server),
        /from_number: m\.canale === "cloud" \? "cloud" : "manychat"/.test(server),
      ],
    );
    c(
      "porta.server: nei log mai il token (nessun console.* che nomina il token o le chiavi)",
      false,
      /console\.(log|warn|error)[^\n]*(token|phoneNumberId|cloud\.)/i.test(server),
    );
    c(
      "api.whatsapp-send: l'anteprima la passa solo se la chat la dichiara (=== true), mai per modello o automatico",
      true,
      /anteprimaLink:\s*body\.anteprimaLink === true && !automatico && !body\.templateName/.test(
        rotta,
      ),
    );
    c(
      "rotta dell'interruttore: dietro la guardia «impostazioni», accende solo con le chiavi, spegne sempre",
      [true, true, true, false],
      [
        /guardiaCRM\(request, cors, "impostazioni"\)/.test(pannello),
        /chiaviMetaPresenti|chiavi/.test(pannello),
        /CHIAVE_ANTEPRIMA_LINK/.test(pannello),
        /console\.[a-z]+\([^)]*(token|access_token)/i.test(pannello),
      ],
    );
  }

  /* ── 8. IL WEBINAR E GLI ALTRI CHIAMANTI RESTANO SU MANYCHAT ─────────── */
  {
    const src = join(radice, "src");
    const file = readdirSync(src, { recursive: true })
      .map(String)
      .filter((f) => /\.(ts|tsx)$/.test(f) && !f.endsWith("routeTree.gen.ts"));
    const dichiarano = file.filter((f) =>
      /anteprimaLink\s*:\s*true/.test(readFileSync(join(src, f), "utf8")),
    );
    c(
      "solo la casella della chat dichiara `anteprimaLink: true` (il webinar e i pannelli no)",
      ["crm/chatwa/useChatWa.ts"],
      dichiarano,
    );
    const chat = readFileSync(join(src, "crm/chatwa/useChatWa.ts"), "utf8");
    c(
      "la chat lo dichiara solo per il testo libero, non per i modelli",
      [true, false],
      [
        /manda\(\{ body: bozza\.trim\(\), anteprimaLink: true \}\)/.test(chat),
        /templateName: m\.nome[^}]*anteprimaLink/.test(chat),
      ],
    );
    const webinar = readFileSync(join(src, "routes/api.crm.webinar.ts"), "utf8");
    c(
      "il tasto del webinar non nomina l'anteprima né la strada Cloud",
      false,
      /anteprimaLink|preview_url/.test(webinar),
    );
    //  Quello che arriva alla porta dal webinar (testo con link, senza il campo) resta su ManyChat.
    const x = creaPorte();
    const r = await P.inviaWhatsapp(x.porte, {
      ...manuale,
      anteprimaLink: undefined,
      testo: "Siamo in diretta: https://hair-genius-hub.hair/w/abc",
    });
    c(
      "testo con link, interruttore acceso, finestra aperta, ma senza il campo: ManyChat",
      ["ok", 0, true],
      [r.esito, x.cloud.length, percorsiManychat(x).includes(PERCORSI.testo)],
    );
  }

  /* ── 9. LE CHIAVI META SOLO SUL SERVER ────────────────────────────────── */
  {
    const W = mod["whatsapp-chiavi"];
    const sorgente = (rel) => readFileSync(join(radice, rel), "utf8");
    const migrazione = sorgente("supabase/migrations/20261031170000_whatsapp_chiavi_server.sql");
    //  Solo le istruzioni, senza i commenti: i nomi dei segreti nei commenti ci possono stare.
    const istruzioni = migrazione.replace(/--[^\n]*/g, "");
    const grant = [...istruzioni.matchAll(/GRANT\s+(?:SELECT|INSERT|UPDATE)\s*\(([^)]*)\)/gi)].map(
      (m) => m[1],
    );
    c(
      "migrazione: toglie al browser SELECT, INSERT e UPDATE sull'intera tabella",
      true,
      /REVOKE\s+SELECT,\s*INSERT,\s*UPDATE\s+ON\s+public\.whatsapp_settings\s+FROM\s+anon,\s*authenticated/i.test(
        istruzioni,
      ),
    );
    c("migrazione: rida SELECT, INSERT e UPDATE solo per colonna (3 GRANT)", 3, grant.length);
    c(
      "migrazione: nessun GRANT concede access_token, app_secret o webhook_verify_token",
      false,
      grant.some((g) => /access_token|app_secret|webhook_verify_token/.test(g)),
    );
    c(
      "migrazione: nessun GRANT di tabella intera (che annullerebbe la REVOKE di colonna)",
      false,
      /GRANT\s+(?:ALL|SELECT|INSERT|UPDATE)(?:\s*,\s*\w+)*\s+ON\s/i.test(istruzioni),
    );
    c(
      "migrazione: solo permessi, nessun dato toccato",
      false,
      /\b(DROP|DELETE|TRUNCATE|ALTER\s+TABLE|UPDATE\s+public)\b/i.test(istruzioni),
    );
    c(
      "…e la stessa migrazione è copiata in SETUP-COMPLETO.sql",
      true,
      sorgente("supabase/SETUP-COMPLETO.sql").includes(migrazione.trim()),
    );

    //  Il browser non seleziona più i segreti: nessun file che usa il client del browser li nomina vicino a whatsapp_settings.
    const src = join(radice, "src");
    const file = readdirSync(src, { recursive: true })
      .map(String)
      .filter((f) => /\.(ts|tsx)$/.test(f));
    const colpevoli = [];
    for (const f of file) {
      const t = readFileSync(join(src, f), "utf8");
      if (
        f.startsWith("integrations/") ||
        /supabaseAdmin/.test(t) ||
        /\.server\.ts$/.test(f) ||
        f.startsWith("routes/api.") ||
        f.startsWith("routes/hooks/")
      )
        continue;
      for (const m of t.matchAll(/from\("whatsapp_settings"\)/g)) {
        const blocco = t.slice(m.index, m.index + 250);
        if (/select\(\s*["'`]\*|access_token|app_secret|webhook_verify_token/.test(blocco))
          colpevoli.push(f);
      }
    }
    c("nessun file del browser seleziona o scrive i segreti di whatsapp_settings", [], colpevoli);
    const chat = sorgente("src/crm/chatwa/useChatWa.ts");
    c(
      "la chat non legge più whatsapp_settings: le chiavi 'ci sono' vengono dalla rotta del canale",
      [false, true],
      [
        /whatsapp_settings/.test(chat.replace(/\/\*[\s\S]*?\*\//, "")),
        /chiaviMeta/.test(sorgente("src/routes/api.crm.whatsapp-canale.ts")) &&
          /chiaviMeta/.test(chat),
      ],
    );

    //  Il pannello.
    const pannello = sorgente("src/routes/CRM.impostazioni.tsx");
    c(
      "il pannello: carica dalla rotta del server, non da un select",
      [true, false],
      [
        /fetchCRM\("\/api\/crm\/whatsapp-chiavi"\)/.test(pannello),
        /\.from\("whatsapp_settings"\)\s*\.select\("\*"\)/.test(pannello),
      ],
    );
    c(
      "il pannello: il «Salva» manda i segreti solo se digitati (mai `|| null`)",
      [true, true, false],
      [
        /if \(wa\.access_token\.trim\(\)\) corpo\.access_token = wa\.access_token/.test(pannello),
        /if \(wa\.app_secret\.trim\(\)\) corpo\.app_secret = wa\.app_secret/.test(pannello),
        /access_token: wa\.access_token \|\| null/.test(pannello),
      ],
    );
    c(
      "il pannello: la bozza in sessionStorage non porta mai token né app secret",
      [true, true],
      [
        /JSON\.stringify\(\{ \.\.\.v, access_token: "", app_secret: "" \}\)/.test(
          pannello.replace(/\s+/g, " ").replace(/\( /g, "(").replace(/ \)/g, ")"),
        ) ||
          /JSON\.stringify\(\{\s*\.\.\.v,\s*access_token: "",\s*app_secret: "",?\s*\}\)/.test(
            pannello,
          ),
        /access_token: "",\s*app_secret: "",\s*\}\s*:\s*null/.test(pannello),
      ],
    );

    //  Le due regole pure.
    const conSegreti = {
      phone_number_id: "111",
      business_account_id: "222",
      mode: "live",
      access_token: TOKEN_FINTO,
      app_secret: "SEGRETO-APP-FINTO",
      webhook_verify_token: "verifica",
    };
    const stato = W.statoChiavi(conSegreti);
    c(
      "lo stato per il browser: token e app secret solo sì/no",
      [true, true, false, false],
      [
        stato.haToken,
        stato.haAppSecret,
        JSON.stringify(stato).includes(TOKEN_FINTO),
        JSON.stringify(stato).includes("SEGRETO-APP-FINTO"),
      ],
    );
    c(
      "…il verify token esce (serve per incollarlo in Meta)",
      "verifica",
      stato.webhook_verify_token,
    );
    c(
      "…senza riga, tutto vuoto e nessun segreto",
      [false, false, "live"],
      ((v) => [v.haToken, v.haAppSecret, v.mode])(W.statoChiavi(null)),
    );
    const salva = (corpo) => W.patchChiavi(corpo);
    c(
      "un salvataggio senza token non lo cancella",
      { ok: true, patch: { phone_number_id: "111", business_account_id: "222", mode: "live" } },
      salva({ phone_number_id: "111", business_account_id: "222", mode: "live" }),
    );
    c(
      "…neanche con il token vuoto, spazi o app secret vuoto",
      { ok: true, patch: { phone_number_id: "111" } },
      salva({
        phone_number_id: "111",
        access_token: "",
        app_secret: "   ",
        webhook_verify_token: "",
      }),
    );
    c(
      "…con il token nuovo lo scrive (senza spazi)",
      { ok: true, patch: { access_token: "EAAnuovo" } },
      salva({ access_token: "  EAAnuovo " }),
    );
    c(
      "…per cancellarlo serve dirlo",
      { ok: true, patch: { access_token: null } },
      salva({ cancella: ["access_token"] }),
    );
    c("…e si cancellano solo i segreti noti", false, salva({ cancella: ["phone_number_id"] }).ok);
    c(
      "modalità sbagliata o corpo non valido: rifiuto",
      [false, false, false],
      [salva({ mode: "boh" }).ok, salva(null).ok, salva({ access_token: 5 }).ok],
    );

    //  La rotta.
    const rotta = sorgente("src/routes/api.crm.whatsapp-chiavi.ts");
    c(
      "rotta: GET e POST dietro «impostazioni» (403 senza), titolare obbligatorio, risposte mai col token",
      [2, true, true, false],
      [
        (rotta.match(/guardiaCRM\(request, cors, "impostazioni"\)/g) ?? []).length,
        /adminUserId\) return json\(\{ error: FRASE_TITOLARE \}, 403\)/.test(rotta),
        /statoChiavi\(data\)/.test(rotta),
        /console\.[a-z]+\([^)]*(token|secret)/i.test(rotta),
      ],
    );
  }
}
