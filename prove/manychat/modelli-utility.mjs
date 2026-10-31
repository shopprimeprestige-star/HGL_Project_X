import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildSync } from "esbuild";
import { creaFinto, esiti, PERCORSI } from "./finto.mjs";

/** Impacchetta un modulo `.ts` puro in una cartella temporanea e lo carica. */
function carica(radice, relativo) {
  const dove = mkdtempSync(join(tmpdir(), "modelli-utility-"));
  try {
    const fuori = join(dove, "modulo.cjs");
    buildSync({
      entryPoints: [join(radice, relativo)],
      bundle: true,
      format: "cjs",
      outfile: fuori,
      alias: { "@": join(radice, "src") },
      logLevel: "error",
    });
    return createRequire(import.meta.url)(fuori);
  } finally {
    rmSync(dove, { recursive: true, force: true });
  }
}

/** ── PROVE: I MODELLI NUOVI «_311026» (tutti da UTILITY) ───────────────────
 *
 *  Commessa 2026-10-31-modelli-utility. Il titolare vuole una copia di OGNI
 *  modello, con un nome nuovo che finisce con la data (31/10/2026) e un testo
 *  da UTILITY, da far approvare a Meta; i vecchi restano finché i nuovi non
 *  sono approvati (si cancellano dopo, a mano). Un interruttore unico fa
 *  passare ogni chiave dal vecchio al nuovo, spento di serie.
 *
 *  Qui: i nomi, le categorie, le variabili, le parole di vendita (lista nera),
 *  header immagine e pulsante dei modelli col link del meet, la conversione dei
 *  parametri, e la porta (interruttore spento = identica a prima).
 *  Dati inventati. `mod`: moduli impacchettati; `aiuti`: { c, gruppo, radice }. */

/** Le parole che fanno classificare un modello come MARKETING. Un testo UTILITY
 *  non ne contiene nessuna. */
export const LISTA_NERA = [
  /gratuit/i,
  /\bgratis\b/i,
  /offert/i,
  /scont[oi]/i,
  /promo/i,
  /occasion/i,
  /imperdibil/i,
  /esclusiv/i,
  /scopri/i,
  /approfitt/i,
  /acquist/i,
  /\bcompra/i,
  /\bprezz/i,
  /preventiv/i,
  /migliore/i,
  /\bunic[oa]\b/i,
  /innovativ/i,
  /rivoluzion/i,
  /novit/i,
  /special[ei]\b/i,
  /limitat/i,
  /affrettat/i,
  /non perdere/i,
  /iscriviti/i,
  /prenota ora/i,
  /\bclicca/i,
  /casi reali/i,
  /senza impegno/i,
  /garanzi/i,
  /risultat/i,
  /vengono da noi/i,
  /tutta europa/i,
  /invisible derm/i,
  /bio-mimetic/i,
];

const SUFFISSO = "_311026";
const LINK_PERSONALE = "https://hair-genius-hub.hair/meetly/kfr-mbqd-tzp?chi=pAbC12";
const SUFFISSO_LINK = "kfr-mbqd-tzp?chi=pAbC12";

export async function proveModelliUtility(mod, { c, gruppo, radice }) {
  const T = mod["wa-meta-templates"];
  const P = mod["manychat/porta"];
  const A = mod["manychat/api"];
  const vecchi = [...T.META_TEMPLATES, ...T.MODELLI_MANYCHAT, ...T.MODELLI_DA_APPROVARE];
  const nuovi = T.MODELLI_UTILITY_311026;
  const nomiVecchi = new Set(vecchi.map((t) => t.name));
  const segnaposti = (t) =>
    [...new Set([...t.body.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1])))].sort(
      (a, b) => a - b,
    );

  gruppo("MODELLI _311026 · I NOMI");
  c("i vecchi restano tutti: 14 + 22 + 1", [14, 22, 1], [
    T.META_TEMPLATES.length,
    T.MODELLI_MANYCHAT.length,
    T.MODELLI_DA_APPROVARE.length,
  ]);
  c("ogni nuovo finisce con _311026", [], nuovi.filter((t) => !t.name.endsWith(SUFFISSO)).map((t) => t.name));
  c(
    "nomi ammessi da Meta: minuscole, cifre e trattino basso",
    [],
    nuovi.filter((t) => !/^[a-z0-9_]{1,512}$/.test(t.name)).map((t) => t.name),
  );
  c("nessun nome nuovo ripetuto", nuovi.length, new Set(nuovi.map((t) => t.name)).size);
  c("nessun nome nuovo coincide con uno vecchio", [], nuovi.filter((t) => nomiVecchi.has(t.name)).map((t) => t.name));
  c(
    "nessun nuovo è il vecchio con la sola data in coda (nomi davvero diversi)",
    [],
    nuovi.filter((t) => t.name === `${t.sostituisce}${SUFFISSO}`).map((t) => t.name),
  );
  c("lingua italiana", [], nuovi.filter((t) => t.language !== "it").map((t) => t.name));
  c(
    "ogni nuovo dice quale vecchio sostituisce, e quel vecchio esiste",
    [],
    nuovi.filter((t) => !nomiVecchi.has(t.sostituisce)).map((t) => t.name),
  );
  c("un nuovo per ogni vecchio, mai due per lo stesso", nuovi.length, new Set(nuovi.map((t) => t.sostituisce)).size);
  //  hgl_meet_domani_testo NON è un modello Meta: è il testo libero dentro le 24 ore.
  const senzaNuovo = vecchi.filter((t) => !nuovi.some((n) => n.sostituisce === t.name)).map((t) => t.name);
  c("l'unico vecchio senza nuovo è il testo libero «hgl_meet_domani_testo»", ["hgl_meet_domani_testo"], senzaNuovo);
  c("in tutto 36 modelli nuovi", 36, nuovi.length);
  c(
    "esempio del titolare: hgl_promemoria_meet → hgl_promemoria_consulenza_311026",
    "hgl_promemoria_consulenza_311026",
    nuovi.find((t) => t.sostituisce === "hgl_promemoria_meet")?.name,
  );
  c(
    "la mappa vecchio → nuovo coincide con l'elenco",
    Object.fromEntries(nuovi.map((t) => [t.sostituisce, t.name])),
    T.NOME_NUOVO_311026,
  );
  c(
    "i nuovi si trovano per nome (la chat li legge dal segnaposto «[template:…]»)",
    [],
    nuovi.filter((t) => T.findMetaTemplate(t.name)?.name !== t.name).map((t) => t.name),
  );

  gruppo("MODELLI _311026 · CATEGORIA UTILITY E LISTA NERA");
  const restanoMarketing = nuovi.filter((t) => t.category === "MARKETING").map((t) => t.sostituisce).sort();
  c(
    "restano MARKETING solo i due che per natura lo sono (casi clienti, follow-up della proposta)",
    ["follow_up_valutazione", "hgl_casi_reali"],
    restanoMarketing,
  );
  c(
    "«fissa_meet», prima MARKETING, ora è UTILITY (la consulenza l'ha chiesta il cliente)",
    "UTILITY",
    nuovi.find((t) => t.sostituisce === "fissa_meet")?.category,
  );
  const utility = nuovi.filter((t) => t.category === "UTILITY");
  c("34 modelli UTILITY", 34, utility.length);
  c(
    "nessuna parola di vendita nei testi UTILITY (lista nera)",
    [],
    utility.flatMap((t) => LISTA_NERA.filter((re) => re.test(t.body)).map((re) => `${t.name}: ${re}`)),
  );
  c(
    "e neanche nel testo dei pulsanti",
    [],
    utility.flatMap((t) => LISTA_NERA.filter((re) => re.test(t.pulsante?.testo ?? "")).map((re) => `${t.name}: ${re}`)),
  );
  c("niente punti esclamativi, niente emoji, niente maiuscole gridate", [], nuovi
    .filter((t) => /!|\p{Extended_Pictographic}|\b[A-ZÀ-Ý]{4,}\b/u.test(t.body.replace(/SÌ/g, "si")))
    .map((t) => t.name));
  c(
    "il testo UTILITY non contiene indirizzi web (il link sta nel pulsante)",
    [],
    utility.filter((t) => /https?:\/\/|www\./i.test(t.body)).map((t) => t.name),
  );
  c("lista nera: si accorge davvero di una frase di vendita", true, LISTA_NERA.some((re) => re.test("Approfitta dello sconto: consulenza gratuita")));

  gruppo("MODELLI _311026 · FORMATO LEGGIBILE");
  c(
    "saluto, riga vuota, informazione, riga vuota, chiusura con la firma",
    [],
    nuovi
      .filter((t) => {
        const blocchi = t.body.split("\n\n");
        return (
          blocchi.length < 3 ||
          blocchi.length > 4 ||
          !/^[^\n]+,$/.test(blocchi[0]) ||
          !/Hair Genius Labs$/.test(blocchi.at(-1)) ||
          /\n\n\n/.test(t.body) ||
          blocchi.some((b) => !b.trim())
        );
      })
      .map((t) => t.name),
  );
  c(
    "il saluto è «Gentile …», «Buongiorno …» o «Ciao …», col nome",
    [],
    nuovi.filter((t) => !/^(Gentile|Buongiorno|Ciao) \{\{1\}\},\n\n/.test(t.body)).map((t) => t.name),
  );
  c(
    "la chiusura è breve (al massimo tre righe)",
    [],
    nuovi.filter((t) => t.body.split("\n\n").at(-1).split("\n").length > 3).map((t) => t.name),
  );
  c(
    "la prima riga di ogni testo comincia con la maiuscola e il corpo non inizia né finisce con una variabile",
    [],
    nuovi.filter((t) => /^\{\{|\}\}$/.test(t.body.trim())).map((t) => t.name),
  );

  gruppo("MODELLI _311026 · LE VARIABILI");
  c(
    "i segnaposto del testo sono 1…N senza buchi, e sono tutti i parametri",
    [],
    nuovi
      .filter((t) => {
        const s = segnaposti(t);
        return s.length !== t.params.length || s.some((n, i) => n !== i + 1);
      })
      .map((t) => t.name),
  );
  c(
    "gli indici dei parametri sono 1…N nell'ordine",
    [],
    nuovi.filter((t) => t.params.some((p, i) => p.index !== i + 1)).map((t) => t.name),
  );
  c(
    "ogni parametro ha un valore d'esempio pieno, senza dati veri",
    [],
    nuovi.flatMap((t) => t.params.filter((p) => !p.example.trim()).map((p) => `${t.name}:${p.key}`)),
  );
  c(
    "il nome del cliente è sempre {{1}}",
    [],
    nuovi.filter((t) => t.params[0]?.key !== "lead_name").map((t) => t.name),
  );
  c(
    "i parametri del nuovo sono un sottoinsieme di quelli del vecchio (chi chiama non cambia)",
    [],
    nuovi
      .filter((t) => {
        const v = vecchi.find((x) => x.name === t.sostituisce);
        const chiavi = new Set(v.params.map((p) => p.key));
        return t.params.some((p) => !chiavi.has(p.key));
      })
      .map((t) => t.name),
  );
  c(
    "nessun nuovo modello porta il link nudo fra i parametri del testo",
    [],
    nuovi.filter((t) => t.params.some((p) => p.key === "meet_link")).map((t) => t.name),
  );
  c(
    "al massimo 4 variabili in tutto (testo + pulsante) per i modelli di ManyChat; fa eccezione il solo modello della Cloud API",
    ["promemoria_collegamento_311026"],
    nuovi
      .filter((t) => t.params.length + (t.pulsante?.da ? 1 : 0) > P.MAX_PARAMETRI)
      .map((t) => t.name),
  );

  gruppo("MODELLI _311026 · I MODELLI COL LINK DEL MEET: IMMAGINE IN TESTA E PULSANTE");
  const colLink = vecchi.filter((t) => t.params.some((p) => p.key === "meet_link")).map((t) => t.name);
  c(
    "i vecchi col link sono i cinque noti",
    ["consulenza_conferma_presenza", "hgl_meet_adesso", "hgl_meet_oggi_link", "hgl_promemoria_meet", "promemoria_meet"],
    [...colLink].sort(),
  );
  const nuoviColLink = nuovi.filter((t) => colLink.includes(t.sostituisce));
  c("e hanno tutti il loro nuovo", 5, nuoviColLink.length);
  c(
    "header di tipo IMMAGINE, con il file del repo e l'indirizzo pubblico",
    [],
    nuoviColLink
      .filter(
        (t) =>
          t.header?.tipo !== "IMAGE" ||
          t.header.file !== "public/anteprima-predefinita.jpg" ||
          t.header.url !== "https://hair-genius-hub.hair/anteprima-predefinita.jpg",
      )
      .map((t) => t.name),
  );
  c("il file dell'immagine esiste ed è un JPEG", [true, 0xff, 0xd8], (() => {
    const f = join(radice, "public/anteprima-predefinita.jpg");
    if (!existsSync(f)) return [false];
    const b = readFileSync(f);
    return [true, b[0], b[1]];
  })());
  c(
    "pulsante «Entra nella consulenza» con indirizzo dinamico https://hair-genius-hub.hair/meetly/{{1}}",
    [],
    nuoviColLink
      .filter(
        (t) =>
          t.pulsante?.testo !== "Entra nella consulenza" ||
          t.pulsante.url !== "https://hair-genius-hub.hair/meetly/{{1}}" ||
          t.pulsante.da !== "meet_link" ||
          !t.pulsante.esempio,
      )
      .map((t) => t.name),
  );
  c("il testo del pulsante sta nei 25 caratteri di Meta", true, "Entra nella consulenza".length <= 25);
  c(
    "il testo dice dove sta il pulsante, senza link nudo",
    [],
    nuoviColLink.filter((t) => !/Entra nella consulenza/.test(t.body) || /https?:\/\//.test(t.body)).map((t) => t.name),
  );
  c(
    "gli altri modelli UTILITY non hanno né header né pulsante",
    [],
    utility.filter((t) => !colLink.includes(t.sostituisce) && (t.header || t.pulsante)).map((t) => t.name),
  );
  const casi = nuovi.find((t) => t.sostituisce === "hgl_casi_reali");
  c(
    "i casi clienti (MARKETING) tengono immagine in testa e pulsante con indirizzo fisso, come il vecchio",
    ["IMAGE", "https://hair-genius-hub.hair/media/DPKW-3JHV-RC77", undefined],
    [casi.header?.tipo, casi.pulsante?.url, casi.pulsante?.da],
  );
  c(
    "l'immagine di Meetly: l'og:image della stanza ripiega su questo stesso file",
    true,
    /anteprime\/_predefinita\.jpg/.test(readFileSync(join(radice, "src/routes/api.og.anteprima.ts"), "utf8")) &&
      existsSync(join(radice, "public/anteprima-predefinita.jpg")),
  );

  gruppo("MODELLI _311026 · DAL LINK PERSONALE ALLA PARTE VARIABILE DEL PULSANTE");
  c("link della stanza con il gettone di chi lo riceve", SUFFISSO_LINK, T.suffissoMeetly(LINK_PERSONALE));
  c("link della stanza senza gettone", "kfr-mbqd-tzp", T.suffissoMeetly("https://hair-genius-hub.hair/meetly/kfr-mbqd-tzp"));
  c(
    "unito all'indirizzo del pulsante dà di nuovo il link personale",
    LINK_PERSONALE,
    "https://hair-genius-hub.hair/meetly/{{1}}".replace("{{1}}", T.suffissoMeetly(LINK_PERSONALE)),
  );
  c(
    "un link che non è una stanza nostra non si converte",
    [null, null, null, null, null],
    [
      T.suffissoMeetly("https://meet.google.com/abc-defg-hij"),
      T.suffissoMeetly("https://hair-genius-hub.hair/videochiamata/abc"),
      T.suffissoMeetly("https://hair-genius-hub.hair/meetly/"),
      T.suffissoMeetly("http://hair-genius-hub.hair/meetly/abc"),
      T.suffissoMeetly(""),
    ],
  );
  c("spazi e a capo nel link: non si converte", null, T.suffissoMeetly("https://hair-genius-hub.hair/meetly/ab c"));

  gruppo("MODELLI _311026 · I PARAMETRI SI CONVERTONO DAL VECCHIO AL NUOVO");
  const conv = (vecchio, par) => T.convertiModelloUtility(vecchio, par);
  c(
    "promemoria 20 minuti prima: nome, ora, consulente + la parte variabile del pulsante",
    { modello: "hgl_promemoria_consulenza_311026", parametri: ["Mario", "18:00", "Luca", SUFFISSO_LINK] },
    conv("hgl_promemoria_meet", ["Mario", "18:00", LINK_PERSONALE, "Luca"]),
  );
  c(
    "meet adesso: nome, consulente, pulsante",
    { modello: "hgl_consulenza_in_corso_311026", parametri: ["Mario", "Luca", SUFFISSO_LINK] },
    conv("hgl_meet_adesso", ["Mario", "Luca", LINK_PERSONALE]),
  );
  c(
    "mattina col link",
    { modello: "hgl_consulenza_oggi_con_link_311026", parametri: ["Mario", "18:00", "Luca", SUFFISSO_LINK] },
    conv("hgl_meet_oggi_link", ["Mario", "18:00", "Luca", LINK_PERSONALE]),
  );
  c(
    "conferma della consulenza (la manda il cron): nome, giorno, ora, pulsante",
    { modello: "conferma_consulenza_online_311026", parametri: ["Mario", "giovedì 29 ottobre", "18:00", SUFFISSO_LINK] },
    conv("consulenza_conferma_presenza", ["Mario", "giovedì 29 ottobre", "18:00", LINK_PERSONALE]),
  );
  c(
    "un modello senza link: stessi valori, solo quelli che il nuovo testo usa",
    { modello: "hgl_richiesta_in_sospeso_311026", parametri: ["Mario"] },
    conv("hgl_come_eravamo_rimasti", ["Mario", "Luca"]),
  );
  c("link che non si converte: niente nuovo (parte il vecchio)", null, conv("hgl_promemoria_meet", ["Mario", "18:00", "https://meet.google.com/x-y-z", "Luca"]));
  c("un valore mancante: niente nuovo", null, conv("hgl_promemoria_meet", ["Mario", "18:00"]));
  c("il testo libero del giorno prima non ha un nuovo", null, conv("hgl_meet_domani_testo", ["Mario", "giovedì", "18:00", "Luca"]));
  c("un nome sconosciuto non ha un nuovo", null, conv("modello_che_non_c_e", ["Mario"]));
  c("un nome già nuovo non si converte due volte", null, conv("hgl_promemoria_consulenza_311026", ["Mario", "18:00", "Luca", SUFFISSO_LINK]));
  //  Ogni modello nuovo si converte dai valori d'esempio del vecchio.
  const esempioDi = (t) => t.params.map((p) => (p.key === "meet_link" ? LINK_PERSONALE : p.example));
  const falliti = [];
  const lunghezzeSbagliate = [];
  for (const n of nuovi) {
    const v = vecchi.find((x) => x.name === n.sostituisce);
    const r = conv(v.name, esempioDi(v));
    if (!r) {
      falliti.push(n.name);
      continue;
    }
    if (r.modello !== n.name) falliti.push(`${n.name}: nome ${r.modello}`);
    if (r.parametri.length !== n.params.length + (n.pulsante?.da ? 1 : 0)) lunghezzeSbagliate.push(n.name);
    if (r.parametri.some((x) => !String(x).trim())) falliti.push(`${n.name}: valore vuoto`);
    if (n.pulsante?.da && r.parametri.at(-1) !== SUFFISSO_LINK) falliti.push(`${n.name}: pulsante`);
  }
  c("ogni nuovo si converte dai parametri del suo vecchio", [], falliti);
  c("…con tanti valori quante variabili (testo + pulsante)", [], lunghezzeSbagliate);

  gruppo("MODELLI _311026 · L'INTERRUTTORE È SPENTO DI SERIE");
  c(
    "nessuna riga, vuota, «off», «no», cose strane: spento",
    [false, false, false, false, false, false, false],
    [undefined, null, "", "off", "no", "0", "forse"].map((v) => T.interruttoreAcceso(v)),
  );
  c("«on», «true», «1», «sì» (anche con maiuscole e spazi): acceso", [true, true, true, true, true], ["on", " ON ", "true", "1", "sì"].map((v) => T.interruttoreAcceso(v)));
  c("la chiave in app_config", "modelli_utility_311026", T.CHIAVE_INTERRUTTORE_311026);
  const server = readFileSync(join(radice, "src/crm/manychat/porta.server.ts"), "utf8");
  c(
    "porta.server.ts legge app_config con quella chiave (nessuna migrazione) e, se non risponde, resta spento",
    [true, true, true],
    [
      /from\("app_config"\)/.test(server),
      /CHIAVE_INTERRUTTORE_311026/.test(server),
      /modelliUtility:/.test(server),
    ],
  );
  c(
    "nessuna migrazione nuova per l'interruttore",
    [],
    (await import("node:fs")).readdirSync(join(radice, "supabase/migrations")).filter((f) => /311026|modelli_utility/.test(f)),
  );

  gruppo("MODELLI _311026 · LA PORTA, CANALE MANYCHAT");
  const NUMERO = "393331234567";
  const FLUSSI = {
    hgl_promemoria_meet: "ns-vecchio-promemoria",
    hgl_promemoria_consulenza_311026: "ns-nuovo-promemoria",
    hgl_non_risponde: "ns-vecchio-non-risponde",
    hgl_meet_adesso: "ns-vecchio-adesso",
    hgl_consulenza_in_corso_311026: "ns-nuovo-adesso",
  };
  function creaPorte({ acceso, flussi = FLUSSI, ultimaEntrata, interruttoreGuasto } = {}) {
    const f = creaFinto().su("GET", PERCORSI.campi, esiti.successo([{ id: 501, name: "crm_telefono", type: "text" }]));
    const messaggi = [];
    const porte = {
      adesso: () => f.orologio.adesso(),
      client: () => A.creaClient({ chiave: "chiave-finta", fetch: f.fetch, timeoutMs: 25 }),
      flusso: async (m) => flussi[m] ?? null,
      prenota: async () => ({ id: "inv1" }),
      esito: async () => undefined,
      subscriberNoto: async () => 1000001,
      registra: async (m) => void messaggi.push(m),
      cloud: async (corpo) => {
        messaggi.push({ cloud: corpo });
        return { status: 200, corpo: { messages: [{ id: "wamid.1" }] } };
      },
      ...(ultimaEntrata ? { ultimaEntrata: async () => ultimaEntrata } : {}),
      ...(acceso === undefined
        ? {}
        : {
            modelliUtility: async () => {
              if (interruttoreGuasto) throw new Error("db giù");
              return acceso;
            },
          }),
    };
    return { porte, f, messaggi };
  }
  const campiDi = (x) =>
    Object.fromEntries(
      (x.f.chiamate.find((q) => q.percorso === PERCORSI.scriviCampi)?.corpo.fields ?? []).map((q) => [q.field_name, q.field_value]),
    );
  const flussoDi = (x) => x.f.chiamate.find((q) => q.percorso === PERCORSI.flusso)?.corpo.flow_ns;
  const promemoria = {
    canale: "manychat",
    a: `+${NUMERO}`,
    tipo: "promemoria",
    modello: "hgl_promemoria_meet",
    parametri: ["Mario", "18:00", LINK_PERSONALE, "Luca"],
    nome: "Mario",
  };

  for (const [come, acceso] of [["senza la porta dell'interruttore", undefined], ["interruttore spento", false]]) {
    const x = creaPorte({ acceso });
    const r = await P.inviaWhatsapp(x.porte, promemoria);
    c(`${come}: parte il modello di sempre, col suo flusso e i suoi quattro valori`, ["ok", "ns-vecchio-promemoria", { crm_v1: "Mario", crm_v2: "18:00", crm_v3: LINK_PERSONALE, crm_v4: "Luca" }], [
      r.esito,
      flussoDi(x),
      Object.fromEntries(Object.entries(campiDi(x)).filter(([k]) => /^crm_v\d$/.test(k))),
    ]);
    c(`${come}: in archivio resta il nome vecchio`, `[template:hgl_promemoria_meet]`, x.messaggi[0].corpo);
  }
  {
    const x = creaPorte({ acceso: true });
    const r = await P.inviaWhatsapp(x.porte, promemoria);
    c("interruttore acceso: parte il modello nuovo, col suo flusso", ["ok", "ns-nuovo-promemoria"], [r.esito, flussoDi(x)]);
    c(
      "…con nome, ora, consulente e la parte variabile del pulsante (il link nudo non viaggia)",
      { crm_v1: "Mario", crm_v2: "18:00", crm_v3: "Luca", crm_v4: SUFFISSO_LINK },
      Object.fromEntries(Object.entries(campiDi(x)).filter(([k]) => /^crm_v\d$/.test(k))),
    );
    c("…e in archivio c'è il nome nuovo", "[template:hgl_promemoria_consulenza_311026]", x.messaggi[0].corpo);
  }
  {
    const x = creaPorte({ acceso: true });
    const r = await P.inviaWhatsapp(x.porte, { ...promemoria, modello: "hgl_non_risponde", parametri: ["Mario"] });
    c("acceso, modello senza flusso nuovo collegato: parte il vecchio, niente si perde", ["ok", "ns-vecchio-non-risponde"], [r.esito, flussoDi(x)]);
  }
  {
    const x = creaPorte({ acceso: true, flussi: { hgl_promemoria_meet: "ns-vecchio-promemoria" } });
    const r = await P.inviaWhatsapp(x.porte, promemoria);
    c(
      "acceso ma il flusso nuovo non è collegato: parte il vecchio, coi suoi valori",
      ["ok", "ns-vecchio-promemoria", LINK_PERSONALE],
      [r.esito, flussoDi(x), campiDi(x).crm_v3],
    );
  }
  {
    const x = creaPorte({ acceso: true });
    const r = await P.inviaWhatsapp(x.porte, { ...promemoria, parametri: ["Mario", "18:00", "https://meet.google.com/a-b-c", "Luca"] });
    c("acceso ma il link non è una stanza nostra: parte il vecchio", ["ok", "ns-vecchio-promemoria"], [r.esito, flussoDi(x)]);
  }
  {
    const x = creaPorte({ acceso: true, interruttoreGuasto: true });
    const r = await P.inviaWhatsapp(x.porte, promemoria);
    c("l'interruttore non si legge: resta spento, parte il vecchio", ["ok", "ns-vecchio-promemoria"], [r.esito, flussoDi(x)]);
  }
  {
    //  Dentro le 24 ore il modello parte come testo normale (col link, che lì mostra l'anteprima):
    //  non cambia, e il modello di riserva è il NUOVO.
    const adesso = creaFinto().orologio.adesso();
    const x = creaPorte({ acceso: true, ultimaEntrata: new Date(adesso.getTime() - 3600_000).toISOString() });
    const r = await P.inviaWhatsapp(x.porte, promemoria);
    const corpo = x.f.chiamate.find((q) => q.percorso === PERCORSI.testo)?.corpo;
    c(
      "dentro le 24 ore: testo normale con il link, come prima",
      ["ok", true, undefined],
      [r.esito, /Per collegarti: https:\/\/hair-genius-hub\.hair\/meetly\/kfr-mbqd-tzp\?chi=pAbC12/.test(JSON.stringify(corpo)), flussoDi(x)],
    );
  }
  {
    const x = creaPorte({ acceso: true, flussi: { ...FLUSSI } });
    const r = await P.inviaWhatsapp(x.porte, { ...promemoria, modello: "hgl_meet_adesso", parametri: ["Mario", "Luca", LINK_PERSONALE] });
    c(
      "meet adesso: modello nuovo, 3 valori (nome, consulente, pulsante)",
      ["ok", "ns-nuovo-adesso", { crm_v1: "Mario", crm_v2: "Luca", crm_v3: SUFFISSO_LINK }],
      [r.esito, flussoDi(x), Object.fromEntries(Object.entries(campiDi(x)).filter(([k]) => /^crm_v\d$/.test(k)))],
    );
  }

  gruppo("MODELLI _311026 · LA PORTA, CANALE CLOUD (header immagine e pulsante)");
  {
    const vecchio = P.corpoGraph({ a: "+393331234567", modello: "promemoria_meet", parametri: ["Mario", "12/05/2026", "15:30", LINK_PERSONALE, "Luca"] });
    c(
      "il corpo Graph di un modello vecchio è quello di sempre: solo il body",
      ["template", ["body"]],
      [vecchio.type, vecchio.template.components.map((k) => k.type)],
    );
    const nuovo = P.corpoGraph({
      a: "+393331234567",
      modello: "promemoria_collegamento_311026",
      parametri: ["Mario", "12/05/2026", "15:30", "Luca", SUFFISSO_LINK],
    });
    const comp = nuovo.template.components;
    c("header immagine, body, pulsante: in quest'ordine", ["header", "body", "button"], comp.map((k) => k.type));
    c("l'immagine è quella pubblica", [{ type: "image", image: { link: "https://hair-genius-hub.hair/anteprima-predefinita.jpg" } }], comp[0].parameters);
    c("il body ha i valori del testo e NON la parte del pulsante", ["Mario", "12/05/2026", "15:30", "Luca"], comp[1].parameters.map((q) => q.text));
    c("il pulsante URL ha la parte variabile", { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: SUFFISSO_LINK }] }, comp[2]);
    const x = creaPorte({ acceso: true });
    const r = await P.inviaWhatsapp(x.porte, {
      canale: "cloud",
      a: "+393331234567",
      tipo: "promemoria",
      modello: "promemoria_meet",
      parametri: ["Mario", "12/05/2026", "15:30", LINK_PERSONALE, "Luca"],
    });
    const spedito = x.messaggi.find((m) => m.cloud)?.cloud;
    c("Cloud con interruttore acceso: parte il modello nuovo con il suo pulsante", [200 === r.status, "promemoria_collegamento_311026", "button"], [
      r.status === 200,
      spedito?.template.name,
      spedito?.template.components.at(-1).type,
    ]);
    const y = creaPorte({ acceso: false });
    await P.inviaWhatsapp(y.porte, {
      canale: "cloud",
      a: "+393331234567",
      tipo: "promemoria",
      modello: "promemoria_meet",
      parametri: ["Mario", "12/05/2026", "15:30", LINK_PERSONALE, "Luca"],
    });
    c("Cloud con interruttore spento: il vecchio, identico", "promemoria_meet", y.messaggi.find((m) => m.cloud)?.cloud.template.name);
  }

  gruppo("MODELLI _311026 · I FLUSSI DA COLLEGARE NEL PANNELLO");
  {
    const V = carica(radice, "src/crm/manychat/vista-pannello.ts");
    const righe = V.MODELLI_FLUSSO_UTILITY_311026;
    c("una riga per ogni modello che passa da un flusso (3 + 19 + i dati della fattura)", 23, righe.length);
    c(
      "ogni riga porta il nome di un modello nuovo che esiste",
      [],
      righe.filter((r) => !nuovi.some((n) => n.name === r.modello)).map((r) => r.modello),
    );
    c("nessun nome ripetuto fra le righe, né coi flussi di prima", righe.length, new Set([...righe.map((r) => r.modello), ...V.MODELLI_FLUSSO.map((r) => r.modello), ...V.MODELLI_FLUSSO_SEQUENZE.map((r) => r.modello)]).size - V.MODELLI_FLUSSO.length - V.MODELLI_FLUSSO_SEQUENZE.length);
    c(
      "la conferma della consulenza e il promemoria hanno il loro flusso nuovo",
      ["conferma_consulenza_online_311026", "hgl_promemoria_consulenza_311026"],
      righe.map((r) => r.modello).filter((m) => /conferma_consulenza|promemoria_consulenza/.test(m)).sort(),
    );
    c("i modelli solo della Cloud API non hanno una riga (non passano da ManyChat)", [], righe.filter((r) => !/^hgl_|conferma_consulenza_online/.test(r.modello)).map((r) => r.modello));
    c("il nome del modello sta nei 64 caratteri che il pannello accetta", [], righe.filter((r) => !/^[A-Za-z0-9_]{1,64}$/.test(r.modello)).map((r) => r.modello));
  }

  gruppo("MODELLI _311026 · LE RETI DI SICUREZZA NEL CODICE");
  {
    const senzaCommenti = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    const modelli = senzaCommenti(readFileSync(join(radice, "src/crm/wa-meta-templates.ts"), "utf8"));
    c("nel file dei modelli nessuna chiave o password", false, /(api[_-]?key|token|password|secret)\s*[:=]\s*["'][^"']{8,}/i.test(modelli));
  }
}
