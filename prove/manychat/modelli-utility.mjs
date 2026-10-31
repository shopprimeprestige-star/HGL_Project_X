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
const LINK_PERSONALE = "https://hair-genius-hub.hair/meetly/kfr-mbqd-tzp?chi=pb4b5c685";
const SUFFISSO_LINK = "kfr-mbqd-tzp?chi=pb4b5c685";
const CODICE_IMMAGINE = "kfr-mbqd-tzp_pb4b5c685";
const URL_IMMAGINE = `https://hair-genius-hub.hair/api/og/anteprima/modello/${CODICE_IMMAGINE}.jpg`;

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
  c("i vecchi restano tutti: 14 + 26 (22 + i 4 gemelli senza link) + 1", [14, 26, 1], [
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
  //  I 4 gemelli `_sl` (31/10/2026, consulenti che non usano Meetly) sono modelli già "Utility" scritti
  //  apposta: non hanno un `_311026` e partono col loro nome anche con l'interruttore acceso.
  c(
    "gli unici senza nuovo: il testo libero «hgl_meet_domani_testo» e i 4 gemelli senza link",
    ["consulenza_conferma_presenza_sl", "hgl_meet_adesso_sl", "hgl_meet_domani_testo", "hgl_meet_oggi_sl", "hgl_promemoria_meet_sl"],
    senzaNuovo.sort(),
  );
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
  //  Revisione 31/10: dati sensibili e affermazioni non vere nei modelli.
  c(
    "nessun modello chiede codice fiscale, partita IVA, documenti o tessera (si chiedono dopo, come testo libero)",
    [],
    nuovi
      .filter((t) => /codice fiscale|partita iva|identit[àa]|tessera|documento|\bSDI\b|\bPEC\b/i.test(t.body))
      .map((t) => t.name),
  );
  const fattura = nuovi.find((t) => t.sostituisce === "hgl_dati_fattura");
  c(
    "dati per la fattura: solo la richiesta generica, poi si risponde",
    "Ciao {{1}},\n\nAbbiamo ricevuto il tuo acconto. Per preparare la fattura ci servono i tuoi dati di fatturazione: rispondi a questo messaggio e ti indichiamo come inviarli.\n\nHair Genius Labs",
    fattura.body,
  );
  const fissa = nuovi.find((t) => t.sostituisce === "fissa_meet");
  c(
    "fissa_meet: «di cui abbiamo parlato», mai «che ci ha richiesto» (i lead richiamati da un consulente non l'hanno chiesta)",
    [true, false],
    [/la consulenza di cui abbiamo parlato/.test(fissa.body), /ha richiesto|richiesta/.test(fissa.body)],
  );
  c(
    "nessun Utility afferma che il cliente ha richiesto la consulenza (non sempre è vero)",
    [],
    utility.filter((t) => /(che|ci) ha richiesto|consulenza tecnica richiesta/i.test(t.body)).map((t) => t.name),
  );
  const piuARischio = ["hgl_ricontatto_consulenza", "hgl_richiamo_24h", "hgl_come_eravamo_rimasti"].map((v) => nuovi.find((t) => t.sostituisce === v));
  c(
    "i tre più a rischio di riclassificazione informano (stato della richiesta) e non sollecitano",
    [],
    piuARischio.filter((t) => /hai domande|Se hai domande|ci indichi quando possiamo ricontattarla\.\n/.test(t.body)).map((t) => t.name),
  );
  c(
    "…e dicono cosa risulta registrato",
    [true, true, true],
    piuARischio.map((t) => /risulta registrat|è registrat/.test(t.body)),
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
  //  ── L'IMMAGINE È DINAMICA: quella personale del cliente, a ogni invio ──
  c(
    "header di tipo IMMAGINE DINAMICA (nessun file fisso né indirizzo fisso), con l'esempio per Meta",
    [],
    nuoviColLink
      .filter(
        (t) =>
          t.header?.tipo !== "IMAGE" ||
          t.header.dinamica !== true ||
          t.header.file !== undefined ||
          t.header.url !== undefined ||
          !/^https:\/\/hair-genius-hub\.hair\/api\/og\/anteprima\/modello\/[A-Za-z0-9_-]+\.jpg$/.test(t.header.esempio),
      )
      .map((t) => t.name),
  );
  c("la bandiera «immagine pronta» e il file fisso non esistono più", [undefined, false], [T.IMMAGINE_MODELLI_PRONTA, existsSync(join(radice, "public/modelli-header.jpg"))]);
  c("la scheda di Meetly (con «GRATUITA») non si tocca e non è in nessun modello Utility", [true, []], [
    existsSync(join(radice, "public/anteprima-predefinita.jpg")),
    utility.filter((t) => /anteprima-predefinita/.test(JSON.stringify(t.header ?? {}))).map((t) => t.name),
  ]);
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
    ["IMAGE", "https://hair-genius-hub.hair/media/DPKW-3JHV-RC77", undefined, "public/anteprima-predefinita.jpg", undefined],
    [casi.header?.tipo, casi.pulsante?.url, casi.pulsante?.da, casi.header?.file, casi.header?.dinamica],
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
    { modello: "hgl_promemoria_consulenza_311026", parametri: ["Mario", "18:00", "Luca", SUFFISSO_LINK], immagine: { codice: CODICE_IMMAGINE, url: URL_IMMAGINE } },
    conv("hgl_promemoria_meet", ["Mario", "18:00", LINK_PERSONALE, "Luca"]),
  );
  c(
    "meet adesso: nome, consulente, pulsante",
    { modello: "hgl_consulenza_in_corso_311026", parametri: ["Mario", "Luca", SUFFISSO_LINK], immagine: { codice: CODICE_IMMAGINE, url: URL_IMMAGINE } },
    conv("hgl_meet_adesso", ["Mario", "Luca", LINK_PERSONALE]),
  );
  c(
    "mattina col link",
    { modello: "hgl_consulenza_oggi_con_link_311026", parametri: ["Mario", "18:00", "Luca", SUFFISSO_LINK], immagine: { codice: CODICE_IMMAGINE, url: URL_IMMAGINE } },
    conv("hgl_meet_oggi_link", ["Mario", "18:00", "Luca", LINK_PERSONALE]),
  );
  c(
    "conferma della consulenza (la manda il cron): nome, giorno, ora, pulsante",
    { modello: "conferma_consulenza_online_311026", parametri: ["Mario", "giovedì 29 ottobre", "18:00", SUFFISSO_LINK], immagine: { codice: CODICE_IMMAGINE, url: URL_IMMAGINE } },
    conv("consulenza_conferma_presenza", ["Mario", "giovedì 29 ottobre", "18:00", LINK_PERSONALE]),
  );
  c(
    "un modello senza link: stessi valori, solo quelli che il nuovo testo usa",
    { modello: "hgl_richiesta_in_sospeso_311026", parametri: ["Mario"] },
    conv("hgl_come_eravamo_rimasti", ["Mario", "Luca"]),
  );
  c("link che non si converte: niente nuovo, col motivo (parte il vecchio)", { ripiego: "link" }, conv("hgl_promemoria_meet", ["Mario", "18:00", "https://meet.google.com/x-y-z", "Luca"]));
  c("un valore mancante: niente nuovo, col motivo", { ripiego: "valori" }, conv("hgl_promemoria_meet", ["Mario", "18:00"]));
  //  ── L'immagine è personale: il suo indirizzo ha SOLO il codice del meet e il gettone di chi lo riceve ──
  const leadA = conv("hgl_promemoria_meet", ["Mario", "18:00", "https://hair-genius-hub.hair/meetly/kfr-mbqd-tzp?chi=pb4b5c685", "Luca"]);
  const leadB = conv("hgl_promemoria_meet", ["Anna", "09:30", "https://hair-genius-hub.hair/meetly/kfr-mbqd-tzp?chi=pf00d1234", "Luca"]);
  const leadC = conv("hgl_promemoria_meet", ["Rita", "11:00", "https://hair-genius-hub.hair/meetly/xyz-abcd-efg?chi=pb4b5c685", "Luca"]);
  c("due clienti della stessa stanza: due immagini diverse, ciascuna la sua", ["kfr-mbqd-tzp_pb4b5c685", "kfr-mbqd-tzp_pf00d1234"], [leadA.immagine.codice, leadB.immagine.codice]);
  c("stesso gettone in un'altra stanza: un'altra immagine", "xyz-abcd-efg_pb4b5c685", leadC.immagine.codice);
  c(
    "l'indirizzo dell'immagine è solo `…/api/og/anteprima/modello/<codice>.jpg`: niente domande, niente nome, ora, telefono o consulente",
    [true, false, false],
    [
      leadA.immagine.url === URL_IMMAGINE,
      /[?&=]|Mario|Luca|18|3331234567/.test(leadA.immagine.url.replace("https://hair-genius-hub.hair/api/og/anteprima/modello/", "").replace(".jpg", "").replace(/[-_]/g, "").replace("kfrmbqdtzppb4b5c685", "")),
      /\?/.test(leadA.immagine.url),
    ],
  );
  c(
    "senza il gettone di chi lo riceve non c'è un'immagine personale (sarebbe quella di un altro): parte il vecchio",
    [{ ripiego: "immagine" }, { ripiego: "immagine" }, { ripiego: "immagine" }],
    [
      conv("hgl_promemoria_meet", ["Mario", "18:00", "https://hair-genius-hub.hair/meetly/kfr-mbqd-tzp", "Luca"]),
      conv("hgl_promemoria_meet", ["Mario", "18:00", "https://hair-genius-hub.hair/meetly/kfr-mbqd-tzp?chi=zzz", "Luca"]),
      conv("hgl_meet_adesso", ["Mario", "Luca", "https://hair-genius-hub.hair/meetly/kfr-mbqd-tzp?x=1"]),
    ],
  );
  c("i modelli senza immagine non hanno un'immagine", undefined, conv("hgl_come_eravamo_rimasti", ["Mario", "Luca"]).immagine);
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
    if (!r || r.ripiego) {
      falliti.push(n.name);
      continue;
    }
    if (r.modello !== n.name) falliti.push(`${n.name}: nome ${r.modello}`);
    if (r.parametri.length !== n.params.length + (n.pulsante?.da ? 1 : 0)) lunghezzeSbagliate.push(n.name);
    if (r.parametri.some((x) => !String(x).trim())) falliti.push(`${n.name}: valore vuoto`);
    if (n.pulsante?.da && r.parametri.at(-1) !== SUFFISSO_LINK) falliti.push(`${n.name}: pulsante`);
    if (!!n.header?.dinamica !== !!r.immagine) falliti.push(`${n.name}: immagine`);
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
  function creaPorte({ acceso, flussi = FLUSSI, ultimaEntrata, interruttoreGuasto, immagini = true, immaginiGuaste = false, cloudRisposte = [], campoNuovo = null } = {}) {
    const f = creaFinto().su("GET", PERCORSI.campi, esiti.successo([{ id: 501, name: "crm_telefono", type: "text" }]));
    const messaggi = [];
    const avvisi = [];
    const richiesteImmagini = [];
    const patchRegistro = [];
    let scritturaCampi = 0;
    //  `campoNuovo`: la scrittura che porta `crm_img` fallisce, come se in ManyChat il campo non ci fosse
    //  ("blocco": risposta 400) o la rete cadesse ("rete": errore non HTTP). "tutti": falliscono TUTTE le
    //  scritture (ManyChat è davvero giù).
    const fetchProvato = async (url, init) => {
      if (new URL(String(url)).pathname === PERCORSI.scriviCampi) {
        scritturaCampi++;
        const nuovo = String(init?.body ?? "").includes("crm_img");
        if (campoNuovo && (nuovo || campoNuovo.endsWith("-tutti"))) {
          if (campoNuovo.startsWith("rete")) throw new TypeError("fetch failed");
          return new Response(JSON.stringify({ status: "error", message: "Custom field not found" }), { status: 400, headers: { "content-type": "application/json" } });
        }
      }
      return f.fetch(url, init);
    };
    const porte = {
      avviso: (codice) => void avvisi.push(codice),
      //  L'immagine personale del cliente: esiste (deposita dal browser) o no. Senza la porta, no.
      ...(immagini === null
        ? {}
        : {
            immagineModello: async (codice) => {
              if (immaginiGuaste) throw new Error("db giù");
              richiesteImmagini.push(codice);
              return immagini === true || (Array.isArray(immagini) && immagini.includes(codice));
            },
          }),
      adesso: () => f.orologio.adesso(),
      client: () => A.creaClient({ chiave: "chiave-finta", fetch: fetchProvato, timeoutMs: 25 }),
      flusso: async (m) => flussi[m] ?? null,
      prenota: async () => ({ id: "inv1" }),
      esito: async (_id, patch) => void patchRegistro.push(patch),
      subscriberNoto: async () => 1000001,
      registra: async (m) => void messaggi.push(m),
      cloud: async (corpo) => {
        messaggi.push({ cloud: corpo });
        return cloudRisposte.shift() ?? { status: 200, corpo: { messages: [{ id: "wamid.1" }] } };
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
    return { porte, f, messaggi, avvisi, richiesteImmagini, patchRegistro, scritture: () => scritturaCampi };
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
    //  Il controllo in porta (commessa 2026-10-31) non c'entra con la scelta del modello: messaggio a mano.
    messaggio: "manuale",
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
    c("nessun ripiego, nessuna riga di registro", [], x.avvisi);
    c("il CRM controlla l'immagine di QUEL cliente (codice del meet + gettone)", [CODICE_IMMAGINE], x.richiesteImmagini);
    c(
      "l'indirizzo dell'immagine personale va nel campo `crm_img`, scritto prima di sendFlow",
      [URL_IMMAGINE, true],
      [campiDi(x).crm_img, x.f.chiamate.findIndex((q) => q.percorso === PERCORSI.scriviCampi) < x.f.chiamate.findIndex((q) => q.percorso === PERCORSI.flusso)],
    );
    c("…e `crm_img` è l'unico campo in più (niente nome, ora, telefono)", ["crm_img", "crm_invio_id", "crm_telefono", "crm_v1", "crm_v2", "crm_v3", "crm_v4"], Object.keys(campiDi(x)).sort());
  }
  {
    //  Lo stesso modello per un altro cliente: la SUA immagine.
    const x = creaPorte({ acceso: true });
    await P.inviaWhatsapp(x.porte, { ...promemoria, parametri: ["Anna", "09:30", "https://hair-genius-hub.hair/meetly/kfr-mbqd-tzp?chi=pf00d1234", "Luca"] });
    c("un altro cliente nella stessa stanza: la sua immagine, non quella del primo", "https://hair-genius-hub.hair/api/og/anteprima/modello/kfr-mbqd-tzp_pf00d1234.jpg", campiDi(x).crm_img);
  }
  {
    //  L'immagine personale non è stata generata (nessuno ha ancora aperto o salvato la consulenza nel CRM).
    const x = creaPorte({ acceso: true, immagini: false });
    const r = await P.inviaWhatsapp(x.porte, promemoria);
    c(
      "acceso ma l'immagine di quel cliente non c'è: parte il vecchio, e la riga di registro lo dice",
      ["ok", "ns-vecchio-promemoria", ["modelli311026_ripiego_immagine"], undefined],
      [r.esito, flussoDi(x), x.avvisi, campiDi(x).crm_img],
    );
    const senzaPorta = creaPorte({ acceso: true, immagini: null });
    const r2 = await P.inviaWhatsapp(senzaPorta.porte, promemoria);
    c("senza la porta che controlla l'immagine: il vecchio (mai un'immagine al buio)", ["ok", "ns-vecchio-promemoria"], [r2.esito, flussoDi(senzaPorta)]);
    const guasta = creaPorte({ acceso: true, immaginiGuaste: true });
    const r3 = await P.inviaWhatsapp(guasta.porte, promemoria);
    c("il controllo dell'immagine si rompe: il vecchio", ["ok", "ns-vecchio-promemoria"], [r3.esito, flussoDi(guasta)]);
    const altra = creaPorte({ acceso: true, immagini: ["xyz-abcd-efg_pb4b5c685"] });
    const r4 = await P.inviaWhatsapp(altra.porte, promemoria);
    c("esiste l'immagine di un altro cliente ma non la sua: il vecchio (mai il nome di un altro)", ["ok", "ns-vecchio-promemoria"], [r4.esito, flussoDi(altra)]);
  }
  {
    //  ── MANCA IL CAMPO `crm_img` IN MANYCHAT (o la rete cade proprio lì) ──
    //  Il nuovo non si può scrivere: parte il vecchio, nello stesso invio, e NON è un guasto da contare
    //  (due falliti di fila, o un errore non HTTP, spegnerebbero tutto l'invio ManyChat).
    for (const [come, campoNuovo] of [["manca il campo (400)", "blocco"], ["errore non HTTP (rete)", "rete"]]) {
      const x = creaPorte({ acceso: true, campoNuovo });
      const r = await P.inviaWhatsapp(x.porte, promemoria);
      c(
        `${come} sul campo nuovo: l'invio riesce col vecchio (esito «ok», nessun codice di guasto)`,
        ["ok", undefined, "ns-vecchio-promemoria"],
        [r.esito, r.codice, flussoDi(x)],
      );
      c(
        `${come}: il vecchio parte coi suoi valori, col link nel testo, senza crm_img`,
        [LINK_PERSONALE, false, "[template:hgl_promemoria_meet]"],
        [campiDi(x).crm_v3, "crm_img" in campiDi(x), x.messaggi[0].corpo],
      );
      c(`${come}: nel registro c'è la riga col codice nuovo`, ["modelli311026_ripiego_campo"], x.avvisi);
      c(
        `${come}: la riga dell'invio non è «fallita» (non conta per lo spegnimento) e dice il flusso vecchio`,
        [true, false],
        [x.patchRegistro.some((p) => p.stato === "inviato" && p.flow_ns === "ns-vecchio-promemoria"), x.patchRegistro.some((p) => p.stato === "fallito" || p.motivo)],
      );
      c(`${come}: due scritture (la nuova, poi la vecchia) e un solo sendFlow`, [2, 1], [x.scritture(), x.f.chiamate.filter((q) => q.percorso === PERCORSI.flusso).length]);
    }
    //  Se ManyChat è DAVVERO giù (anche il vecchio non si scrive) il guasto resta un guasto, come sempre.
    const giu = creaPorte({ acceso: true, campoNuovo: "rete-tutti" });
    const rg = await P.inviaWhatsapp(giu.porte, promemoria);
    c("ManyChat giù per davvero: esito di blocco, come prima (conta)", ["blocco", true], [rg.esito, giu.patchRegistro.some((p) => p.stato === "fallito")]);
    //  Un modello senza il nuovo non cambia: la scrittura fallita è un guasto come sempre.
    const sempre = creaPorte({ acceso: false, campoNuovo: "blocco-tutti" });
    const rs = await P.inviaWhatsapp(sempre.porte, promemoria);
    c("interruttore spento e scrittura fallita: «blocco», nessun ripiego (identico a prima)", ["blocco", []], [rs.esito, sempre.avvisi]);
    //  Il flusso vecchio non è collegato: niente ripiego possibile, resta il guasto.
    const senzaVecchio = creaPorte({ acceso: true, campoNuovo: "blocco", flussi: { hgl_promemoria_consulenza_311026: "ns-nuovo-promemoria" } });
    const rn = await P.inviaWhatsapp(senzaVecchio.porte, promemoria);
    c("nuovo con crm_img che non si scrive e vecchio non collegato: resta il guasto vero", "blocco", rn.esito);
  }
  {
    //  I modelli senza immagine non hanno `crm_img` e non controllano niente.
    const x = creaPorte({ acceso: true, flussi: { hgl_come_eravamo_rimasti: "ns-v", hgl_richiesta_in_sospeso_311026: "ns-n" } });
    await P.inviaWhatsapp(x.porte, { ...promemoria, modello: "hgl_come_eravamo_rimasti", parametri: ["Mario", "Luca"] });
    c("modello senza immagine: nessun `crm_img`, nessun controllo", [false, []], ["crm_img" in campiDi(x), x.richiesteImmagini]);
  }
  {
    const x = creaPorte({ acceso: true });
    const r = await P.inviaWhatsapp(x.porte, { ...promemoria, modello: "hgl_non_risponde", parametri: ["Mario"] });
    c("acceso, modello senza flusso nuovo collegato: parte il vecchio, niente si perde", ["ok", "ns-vecchio-non-risponde"], [r.esito, flussoDi(x)]);
    c("…e la riga di registro dice solo il codice", ["modelli311026_ripiego_flusso"], x.avvisi);
  }
  {
    const x = creaPorte({ acceso: true, flussi: { hgl_promemoria_meet: "ns-vecchio-promemoria" } });
    const r = await P.inviaWhatsapp(x.porte, promemoria);
    c(
      "acceso ma il flusso nuovo non è collegato: parte il vecchio, coi suoi valori",
      ["ok", "ns-vecchio-promemoria", LINK_PERSONALE, ["modelli311026_ripiego_flusso"]],
      [r.esito, flussoDi(x), campiDi(x).crm_v3, x.avvisi],
    );
  }
  {
    const x = creaPorte({ acceso: true });
    const r = await P.inviaWhatsapp(x.porte, { ...promemoria, parametri: ["Mario", "18:00", "https://meet.google.com/a-b-c", "Luca"] });
    c("acceso ma il link non è una stanza nostra: parte il vecchio, con la riga di registro", ["ok", "ns-vecchio-promemoria", ["modelli311026_ripiego_link"]], [r.esito, flussoDi(x), x.avvisi]);
    c("la riga non contiene né numeri né link né nomi", false, /\d{6}|https?:|Mario|Luca/.test(x.avvisi.join(" ").replace(/modelli311026/g, "")));
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
      [r.esito, /Per collegarti: https:\/\/hair-genius-hub\.hair\/meetly\/kfr-mbqd-tzp\?chi=pb4b5c685/.test(JSON.stringify(corpo)), flussoDi(x)],
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
      immagine: URL_IMMAGINE,
    });
    const comp = nuovo.template.components;
    c("header immagine, body, pulsante: in quest'ordine", ["header", "body", "button"], comp.map((k) => k.type));
    c("l'immagine nel parametro header è il link personale di QUEL cliente", [{ type: "image", image: { link: URL_IMMAGINE } }], comp[0].parameters);
    c(
      "header dinamico senza indirizzo: niente header (mai un'immagine vuota)",
      ["body", "button"],
      P.corpoGraph({ a: "+39333", modello: "promemoria_collegamento_311026", parametri: ["Mario", "12/05/2026", "15:30", "Luca", SUFFISSO_LINK] }).template.components.map((k) => k.type),
    );
    c("il body ha i valori del testo e NON la parte del pulsante", ["Mario", "12/05/2026", "15:30", "Luca"], comp[1].parameters.map((q) => q.text));
    c("il pulsante URL ha la parte variabile", { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: SUFFISSO_LINK }] }, comp[2]);
    const x = creaPorte({ acceso: true });
    const r = await P.inviaWhatsapp(x.porte, {
      canale: "cloud",
      a: "+393331234567",
      tipo: "promemoria",
      //  Il controllo in porta (commessa 2026-10-31) non c'entra con la scelta del modello: messaggio a mano.
      messaggio: "manuale",
      modello: "promemoria_meet",
      parametri: ["Mario", "12/05/2026", "15:30", LINK_PERSONALE, "Luca"],
    });
    const spedito = x.messaggi.find((m) => m.cloud)?.cloud;
    c("Cloud con interruttore acceso: parte il modello nuovo con il suo pulsante", [200 === r.status, "promemoria_collegamento_311026", "button"], [
      r.status === 200,
      spedito?.template.name,
      spedito?.template.components.at(-1).type,
    ]);
    c(
      "…e nell'header c'è il link dell'immagine personale di quel cliente",
      [{ type: "image", image: { link: URL_IMMAGINE } }],
      spedito?.template.components[0].parameters,
    );
    const y = creaPorte({ acceso: false });
    await P.inviaWhatsapp(y.porte, {
      canale: "cloud",
      a: "+393331234567",
      tipo: "promemoria",
      //  Il controllo in porta (commessa 2026-10-31) non c'entra con la scelta del modello: messaggio a mano.
      messaggio: "manuale",
      modello: "promemoria_meet",
      parametri: ["Mario", "12/05/2026", "15:30", LINK_PERSONALE, "Luca"],
    });
    c("Cloud con interruttore spento: il vecchio, identico", "promemoria_meet", y.messaggi.find((m) => m.cloud)?.cloud.template.name);
    c("…e nessuna riga di registro", [], y.avvisi);

    //  ── Meta respinge il nuovo (non approvato, in pausa, disabilitato): si rimanda col vecchio. ──
    const rimanda = (codice) => ({ status: 400, corpo: { error: { code: codice, message: "x" } } });
    const richiesta = {
      canale: "cloud",
      a: "+393331234567",
      tipo: "promemoria",
      //  Il controllo in porta (commessa 2026-10-31) non c'entra con la scelta del modello: messaggio a mano.
      messaggio: "manuale",
      modello: "promemoria_meet",
      parametri: ["Mario", "12/05/2026", "15:30", LINK_PERSONALE, "Luca"],
    };
    for (const codice of [132001, 132015, 132016]) {
      const z = creaPorte({ acceso: true, cloudRisposte: [rimanda(codice)] });
      const rz = await P.inviaWhatsapp(z.porte, richiesta);
      const spediti = z.messaggi.filter((m) => m.cloud).map((m) => m.cloud.template.name);
      c(
        `Meta risponde ${codice} al nuovo: lo stesso invio riparte col vecchio, coi suoi valori, e la riga lo dice`,
        [200, ["promemoria_collegamento_311026", "promemoria_meet"], ["modelli311026_cloud_" + codice]],
        [rz.status, spediti, z.avvisi],
      );
      const vecchioInviato = z.messaggi.filter((m) => m.cloud).at(-1).cloud;
      c(
        "…il vecchio porta il link nel testo, come sempre",
        [LINK_PERSONALE, "body"],
        [vecchioInviato.template.components[0].parameters[3].text, vecchioInviato.template.components[0].type],
      );
    }
    const altro = creaPorte({ acceso: true, cloudRisposte: [rimanda(131026)] });
    const ra = await P.inviaWhatsapp(altro.porte, richiesta);
    c("un altro errore di Meta (numero non raggiungibile): niente secondo invio", [400, 1, []], [ra.status, altro.messaggi.filter((m) => m.cloud).length, altro.avvisi]);
    const vecchioRifiutato = creaPorte({ acceso: false, cloudRisposte: [rimanda(132001)] });
    const rv = await P.inviaWhatsapp(vecchioRifiutato.porte, richiesta);
    c("interruttore spento e Meta respinge il vecchio: nessun secondo invio, come prima", [400, 1], [rv.status, vecchioRifiutato.messaggi.filter((m) => m.cloud).length]);
    const entrambi = creaPorte({ acceso: true, cloudRisposte: [rimanda(132001), rimanda(132001)] });
    const re = await P.inviaWhatsapp(entrambi.porte, richiesta);
    c("respinti tutti e due: l'esito è quello del vecchio, e si prova solo due volte", [400, 2], [re.status, entrambi.messaggi.filter((m) => m.cloud).length]);
    const senzaImmagine = creaPorte({ acceso: true, immagini: false });
    await P.inviaWhatsapp(senzaImmagine.porte, richiesta);
    c("Cloud, immagine di quel cliente non generata: parte il vecchio e la riga lo dice", ["promemoria_meet", ["modelli311026_ripiego_immagine"]], [senzaImmagine.messaggi.find((m) => m.cloud).cloud.template.name, senzaImmagine.avvisi]);
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

  gruppo("MODELLI _311026 · L'IMMAGINE PERSONALE: IL BIGLIETTO DA UTILITY");
  {
    const B = carica(radice, "src/crm/biglietto-modello.ts");
    const dati = { nome: "Mario", giorno: "2026-11-05", ora: "18:00", consulente: "Luca", telefono: "393331234567", stanza: "kfr-mbqd-tzp", gettone: "pb4b5c685", link: "https://hair-genius-hub.hair/invito/AB12", durataMinuti: 45 };
    const righe = B.righeBigliettoModello(dati);
    const testo = righe.map((r) => r.testo);
    c("le righe: marchio, titolo, nome, giorno, ora, consulente", ["Hair Genius Labs", "Consulenza Hair Genius Labs", "Mario", "Giovedì 5 novembre", "Ore 18:00", "Con Luca"], testo);
    c("nessun dato oltre a nome, giorno, ora e consulente (niente telefono, durata, link, codici)", false, /3331234567|45|invito|AB12|kfr|pb4b|minuti/i.test(testo.join(" ")));
    c("niente parole di vendita sull'immagine (lista nera)", [], LISTA_NERA.filter((re) => re.test(testo.join(" "))).map(String));
    c("niente «gratuita», «senza impegno», «preventivo», prodotti", false, /gratuit|impegno|preventiv|trapianto|patch|derm|capelli/i.test(testo.join(" ")));
    c("senza consulente: la riga manca, il resto c'è", ["Hair Genius Labs", "Consulenza Hair Genius Labs", "Mario", "Giovedì 5 novembre", "Ore 18:00"], B.righeBigliettoModello({ ...dati, consulente: "" }).map((r) => r.testo));
    c("senza nome, giorno o ora: nessuna immagine (mai «alle ore —»)", [null, null, null], [B.righeBigliettoModello({ ...dati, nome: "" }), B.righeBigliettoModello({ ...dati, giorno: "" }), B.righeBigliettoModello({ ...dati, ora: "" })]);
    c("senza gettone di chi riceve il link: nessuna immagine (sarebbe quella della stanza)", null, B.righeBigliettoModello({ ...dati, gettone: "" }));
    c("misure per Meta: 1200×630, formato JPEG, peso sotto 5 MB", [1200, 630, "image/jpeg", true], [B.LARGHEZZA, B.ALTEZZA, B.TIPO_FILE, B.PESO_MASSIMO_BYTE <= 5 * 1024 * 1024]);
    c("il codice sotto cui si deposita è quello personale (stanza + gettone)", "kfr-mbqd-tzp_pb4b5c685", B.codiceImmaginePersonale(dati));
    c("…e coincide con quello che la porta richiede a ogni invio", CODICE_IMMAGINE, B.codiceImmaginePersonale(dati));
  }

  gruppo("MODELLI _311026 · IL DEPOSITO E LA ROTTA DELL'IMMAGINE (lettura dei sorgenti)");
  {
    const leggi = (f) => readFileSync(join(radice, f), "utf8");
    const dep = leggi("src/routes/api.anteprima.ts");
    const og = leggi("src/routes/api.og.anteprima.ts");
    const perPercorso = leggi("src/routes/api.og.anteprima.$tipo.$codice.ts");
    const link = leggi("src/crm/anteprima-link.ts");
    const porta = leggi("src/crm/manychat/porta.server.ts");
    c("il deposito accetta il tipo «modello» e lo protegge come l'invito (sessione del CRM)", [true, true], [/"invito" \| "preventivo" \| "webinar" \| "capelli" \| "modello"/.test(dep), /tipo === "modello"/.test(dep)]);
    c("la chiave del deposito è quella che la porta controlla", [true, true], [/anteprima:modello:/.test(T.chiaveImmagineModello("kfr-mbqd-tzp_pb4b5c685")) || false, T.chiaveImmagineModello("kfr-mbqd-tzp_pb4b5c685") === "anteprima:modello:kfr-mbqd-tzp_pb4b5c685"]);
    c("la chiave usa lo stesso ripulitore del deposito (lettere, cifre, trattino, punto, trattino basso; 64)", true, /replace\(\/\[\^a-zA-Z0-9\._-\]\/g, ""\)/.test(dep) && T.chiaveImmagineModello("a b/c") === "anteprima:modello:abc");
    c("la rotta serve «modello» da sola: mai la scheda generica con «GRATUITA», mai quella della stanza", [true, true], [/tipo === "modello"/.test(og), /serviImmagineModello/.test(og)]);
    const corpoModello = og.slice(og.indexOf("export async function serviImmagineModello"), og.indexOf("/** Il cuore, condiviso"));
    c("…e se manca il deposito risponde 404, senza ripiego né rimando", [true, false, false], [/status: 404/.test(corpoModello), /RIPIEGO/.test(corpoModello), /status: 302/.test(corpoModello)]);
    c("…con cache corta (la data può cambiare) e solo JPEG/PNG vero", [true, true], [/DURATA_BREVE_S/.test(corpoModello), /image\/jpeg/.test(corpoModello)]);
    c("l'indirizzo a percorso accetta «modello»", true, /v === "modello"/.test(perPercorso));
    c(
      "la forma del codice si controlla: solo «<stanza>_p<gettone>» in minuscolo",
      [true, false, false, false, false, false],
      ["kfr-mbqd-tzp_pb4b5c685", "kfr-mbqd-tzp", "kfr-mbqd-tzp_PB4B5C685", "kfr-mbqd-tzp_b4b5c685", "_pb4b5c685", "kfr mbqd_pb4b5c685"].map((v) => T.formaCodiceImmagineModello(v)),
    );
    c("il deposito rifiuta un codice di forma sbagliata (400), prima di toccare lo spazio file", [true, true], [/tipo === "modello" && !formaCodiceImmagineModello\(codice\)/.test(dep), dep.indexOf("formaCodiceImmagineModello(codice)") < dep.indexOf("storage.createBucket")]);
    c("la rotta risponde 404 a un codice di forma sbagliata, prima di leggere il deposito", [true, true], [/!formaCodiceImmagineModello\(codice\)/.test(corpoModello), corpoModello.indexOf("formaCodiceImmagineModello") < corpoModello.indexOf("anteprimaDepositata")]);
    c("l'anteprima di Meetly non cambia: l'og:image della stanza resta «invito»", true, /anteprimaStanza = \(code: string, chi\?: string\) =>\s*`https:\/\/hair-genius-hub\.hair\/api\/og\/anteprima\/invito\//.test(leggi("src/routes/meetly_.$code.tsx")));
    c("il browser deposita l'immagine da Utility dove deposita già il biglietto, solo sotto il codice personale", [true, true], [/tipo", "modello"/.test(link), /codiceImmaginePersonale/.test(link)]);
    c("la porta del server controlla il deposito direttamente nel database (nessuna richiesta HTTP al proprio sito)", [true, false], [/immagineModello:/.test(porta) && /chiaveImmagineModello/.test(porta), /fetch\(.*hair-genius/.test(porta)]);
  }

  gruppo("MODELLI _311026 · LE RETI DI SICUREZZA NEL CODICE");
  {
    const senzaCommenti = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    const modelli = senzaCommenti(readFileSync(join(radice, "src/crm/wa-meta-templates.ts"), "utf8"));
    c("nel file dei modelli nessuna chiave o password", false, /(api[_-]?key|token|password|secret)\s*[:=]\s*["'][^"']{8,}/i.test(modelli));
  }
}
