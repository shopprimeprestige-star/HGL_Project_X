/** ── PROVE: INVIO A MANO DAL PONTE · chat-ui (compito T4) ──
 *
 *  Commessa 2026-10-30-ponte-invio-manuale. Il disegno: la casella con il tasto
 *  «Scrivi dal telefono», il foglio con il campo di testo (`FormScriviDalPonte`),
 *  la bolla della coda in ogni stato (`BollaMessaggio` con `coda`) e il modo in
 *  cui la conversazione le mescola ai messaggi (dal sorgente). Si disegna con
 *  `react-dom/server` e dati finti: nessuna rete, nessun numero né nome vero.
 *
 *  I moduli di rete (database, accesso, CRM) sono finti; la casella, la bolla e
 *  il foglio sono quelli veri, impacchettati da esbuild. La prova col browser
 *  vero (tocchi, 375 e 1280 px) non sta qui: è in LAVAGNA.
 *
 *  `mod`: i moduli impacchettati da `prove/prove.mjs`. `aiuti`: `{ c, gruppo, radice }`. */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Parole che il titolare non deve mai leggere (le stesse delle frasi del ponte). */
const VIETATE = /\b(QR|Baileys|token|JID|LID|sessione|battito|server|database|API|socket|log|ponte)\b/i;
const EMOJI = /\p{Extended_Pictographic}/u;

const senzaCommenti = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
/** Il testo come lo legge una persona: senza tag, con le entità riportate ai caratteri. */
const testoDi = (html) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

export async function provePonteInvioChatUi(mod, { c, gruppo, radice }) {
  const P = mod["chatwa/invioPonte"];
  const I = mod["ponte/invio"];
  const esbuild = createRequire(import.meta.url)("esbuild");
  const richiedi = createRequire(import.meta.url);
  const dir = mkdtempSync(join(tmpdir(), "ponte-invio-ui-"));
  try {
    /* ── Impacchetto i componenti veri con la rete finta ──────────────────── */
    writeFileSync(join(dir, "client.js"), "export const supabase = {};");
    writeFileSync(
      join(dir, "auth.js"),
      "export const usePuo = () => () => false; export const useAuth = () => ({ user: null }); export const fetchCRM = () => undefined; export const intestazioniCRM = async () => ({});",
    );
    writeFileSync(join(dir, "crm.js"), "export const useCRM = () => ({ consultants: [] });");
    writeFileSync(
      join(dir, "ingresso.tsx"),
      `import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
export { React, renderToStaticMarkup };
export { Casella } from ${JSON.stringify(join(radice, "src/crm/chatwa/Casella.tsx"))};
export { BollaMessaggio } from ${JSON.stringify(join(radice, "src/crm/chatwa/BollaMessaggio.tsx"))};
export { FormScriviDalPonte } from ${JSON.stringify(join(radice, "src/crm/chatwa/ScriviDalPonte.tsx"))};`,
    );
    await esbuild.build({
      entryPoints: [join(dir, "ingresso.tsx")],
      nodePaths: [join(radice, "node_modules")],
      bundle: true,
      format: "cjs",
      platform: "node",
      outfile: join(dir, "ui.cjs"),
      logLevel: "error",
      loader: { ".tsx": "tsx" },
      jsx: "automatic",
      alias: { "@": join(radice, "src") },
      plugins: [
        {
          name: "rete-finta",
          setup(b) {
            b.onResolve({ filter: /^@\/integrations\/supabase\/client$/ }, () => ({ path: join(dir, "client.js") }));
            b.onResolve({ filter: /^@\/crm\/AuthContext$/ }, () => ({ path: join(dir, "auth.js") }));
            b.onResolve({ filter: /^@\/crm\/CRMContext$/ }, () => ({ path: join(dir, "crm.js") }));
          },
        },
      ],
    });
    const { React, renderToStaticMarkup, Casella, BollaMessaggio, FormScriviDalPonte } = richiedi(join(dir, "ui.cjs"));
    const disegna = (el) => renderToStaticMarkup(el);

    /* ── Dati inventati ───────────────────────────────────────────────────── */
    const NUMERO = "+393330000001";
    const ADESSO = Date.parse("2026-10-30T12:00:00.000Z");
    const fa = (ms) => new Date(ADESSO - ms).toISOString();
    const contatto = {
      id: "c1",
      user_id: "u",
      phone_e164: NUMERO,
      lead_id: null,
      display_name: "Cliente di prova",
      last_message_at: fa(30 * 3_600_000),
      unread_count: 0,
      created_at: fa(90 * 3_600_000),
      ultimo_in_entrata_il: fa(30 * 3_600_000),
    };
    const attiva = { phone: NUMERO, leadId: null, lead: null, contact: contatto, lastMessage: null, unread: 0 };
    const ponte = (o = {}) => ({
      puo: { ok: true },
      coda: [],
      restanti: 20,
      inviando: false,
      invia: async () => true,
      riprova: async () => true,
      ...o,
    });
    const api = (o = {}) => ({
      bozza: "",
      setBozza: () => undefined,
      residuiBozza: [],
      invia: async () => undefined,
      inviaModello: async () => undefined,
      inviando: false,
      stato: "solo_modelli",
      attiva,
      canale: null,
      messaggi: [],
      ponte: ponte(),
      ...o,
    });
    const casella = (o) => disegna(React.createElement(Casella, { api: api(o) }));

    /* ═══ La casella ═══ */
    gruppo("PONTE · INVIO A MANO · LA CASELLA (T4)");
    const due = casella();
    const t = testoDi(due);
    //  31/10/2026 (richiesta del titolare): «Scrivi dal telefono» tolto. A finestra chiusa restano
    //  solo «Invia un modello» e «Apri in WhatsApp», anche col ponte che lo consentirebbe.
    c("finestra chiusa: «Invia un modello» c'è, «Scrivi dal telefono» non più", [true, false], [t.includes("Invia un modello"), t.includes("Scrivi dal telefono")]);
    c("…la barra dice ancora «Finestra chiusa · solo modelli approvati»", true, t.includes("Finestra chiusa · solo modelli approvati"));
    const tasti = [...due.matchAll(/<button\b[^>]*>/g)].map((m) => m[0]);
    c("…il tasto del modello è da 44 px (min-h-11)", true, (() => {
      const i = due.indexOf("Invia un modello");
      const aperto = due.lastIndexOf("<button", i);
      return /min-h-11/.test(due.slice(aperto, due.indexOf(">", aperto)));
    })());
    c("…nessuna icona del telefono e nessun emoji", [false, false], [/lucide-smartphone/.test(due), EMOJI.test(due)]);
    c("senza il consenso (puo.ok falso): la casella è IDENTICA a quella senza la funzione", casella({ ponte: undefined }), casella({ ponte: ponte({ puo: { ok: false, motivo: "mai_scritto" } }) }));
    c("…e non nomina il telefono", false, casella({ ponte: ponte({ puo: { ok: false, motivo: "stop" } }) }).includes("Scrivi dal telefono"));
    c("senza `ponte` (la chat di oggi): un solo tasto", [true, false], [casella({ ponte: undefined }).includes("Invia un modello"), casella({ ponte: undefined }).includes("Scrivi dal telefono")]);
    for (const stato of ["libera", "stop", "configura"]) {
      c(`stato «${stato}»: nessun tasto nuovo, nemmeno con il consenso`, false, casella({ stato }).includes("Scrivi dal telefono"));
    }
    c("stato «libera»: è la casella di sempre, identica con o senza `ponte`", casella({ stato: "libera", ponte: undefined }), casella({ stato: "libera" }));
    c("stato «stop»: identica con o senza `ponte`", casella({ stato: "stop", ponte: undefined }), casella({ stato: "stop" }));

    const resta = (n) => testoDi(casella({ ponte: ponte({ restanti: n }) }));
    c("restano più di 5, o non si sa: nessuna riga", [false, false], [resta(6).includes("puoi mandare ancora"), resta(null).includes("puoi mandare ancora")]);
    c("la barra della casella non ha parole tecniche", null, (t.match(VIETATE) ?? [null])[0]);

    /* ═══ Il foglio con il campo ═══ */
    gruppo("PONTE · INVIO A MANO · IL CAMPO DI TESTO (T4)");
    const forma = (o = {}) =>
      disegna(
        React.createElement(FormScriviDalPonte, {
          api: ponte(),
          testo: "",
          onTesto: () => undefined,
          onFatto: () => undefined,
          ...o,
        }),
      );
    const vuota = forma();
    const tv = testoDi(vuota);
    const area = vuota.match(/<textarea\b[^>]*>/)?.[0] ?? "";
    c("c'è un campo di testo a 16 px (text-base), con etichetta per chi non vede", [true, true, true], [area !== "", /text-base/.test(area), /aria-label="[^"]+"/.test(area)]);
    c("…il campo non ha un limite che taglia in silenzio (niente maxlength)", false, /maxlength/i.test(area));
    c("…ha il suo spazio per scrivere (almeno 3 righe)", true, /rows="([3-9]|\d\d)"/.test(area));
    c("il contatore parte da 0/2000", true, tv.includes("0/2000"));
    c("…e dice a cosa serve ai lettori di schermo (descritto dal campo)", true, /aria-describedby="[^"]+"/.test(area));
    const bottone = vuota.match(/<button\b[^>]*>(?:(?!<\/button>).)*Invia dal telefono(?:(?!<\/button>).)*<\/button>/s)?.[0] ?? "";
    c("il tasto «Invia dal telefono» c'è, è da 44 px ed è spento a campo vuoto", [true, true, true], [bottone !== "", /min-h-11/.test(bottone), /disabled=""/.test(bottone)]);
    const scritto = forma({ testo: "Buongiorno, ci vediamo domani" });
    c("con del testo il tasto si accende", false, /disabled=""/.test(scritto.match(/<button\b[^>]*>(?:(?!<\/button>).)*Invia dal telefono(?:(?!<\/button>).)*<\/button>/s)?.[0] ?? "x"));
    c("…e il contatore conta i caratteri", true, testoDi(scritto).includes("29/2000"));
    c("solo spazi: il tasto resta spento", true, /disabled=""/.test(forma({ testo: "   \n " }).match(/<button\b[^>]*>(?:(?!<\/button>).)*Invia dal telefono(?:(?!<\/button>).)*<\/button>/s)?.[0] ?? ""));
    const pieno = forma({ testo: "a".repeat(2000) });
    c("2000 caratteri: ancora consentito", [true, false], [testoDi(pieno).includes("2000/2000"), /troppo lungo/.test(testoDi(pieno))]);
    const emoji2000 = forma({ testo: "😀".repeat(2000) });
    c("2000 emoji (4000 unità): si contano i caratteri veri, ancora consentito", true, testoDi(emoji2000).includes("2000/2000") && !/troppo lungo/.test(testoDi(emoji2000)));
    const lungo = forma({ testo: "a".repeat(2001) });
    const bl = lungo.match(/<button\b[^>]*>(?:(?!<\/button>).)*Invia dal telefono(?:(?!<\/button>).)*<\/button>/s)?.[0] ?? "";
    c("2001: il contatore diventa rosso E lo dice a parole; il tasto si spegne", [true, true, true], [/text-destructive|text-red-/.test(lungo.slice(lungo.indexOf("2001/2000") - 200, lungo.indexOf("2001/2000"))), /troppo lungo/.test(testoDi(lungo)), /disabled=""/.test(bl)]);
    const inCorso = forma({ api: ponte({ inviando: true }), testo: "ciao" });
    c("durante l'invio: tasto spento e dice che sta mettendo in coda", [true, true], [/disabled=""/.test(inCorso.match(/<button\b[^>]*>(?:(?!<\/button>).)*Metto in coda(?:(?!<\/button>).)*<\/button>/s)?.[0] ?? ""), /Metto in coda/.test(testoDi(inCorso))]);

    c("sotto il campo: parte dal TUO numero, entro circa un minuto", [true, true], [/dal tuo numero/i.test(tv), /un minuto/.test(tv)]);
    c("…i limiti, con i numeri veri: 1 ogni 20 secondi, 20 al giorno", [true, true], [tv.includes("un messaggio ogni 20 secondi"), tv.includes("al massimo 20 al giorno")]);
    c("…dice che è solo testo, scritto a mano, a chi ti ha già scritto", [true, true, true], [/solo testo/i.test(tv), /a mano/.test(tv), /già scritto/.test(tv)]);
    c("…i numeri della spiegazione sono quelli dei limiti", [true, true], [tv.includes(`ogni ${mod["ponte/invio-tipi"].LIMITI_INVIO.intervalloS} secondi`), tv.includes(`massimo ${mod["ponte/invio-tipi"].LIMITI_INVIO.alGiorno} al giorno`)]);
    c("…nessuna parola tecnica e nessun emoji", [null, false], [(tv.match(VIETATE) ?? [null])[0], EMOJI.test(vuota)]);
    const non = forma({ api: ponte({ puo: { ok: false, motivo: "ponte_non_collegato" } }), testo: "ciao" });
    c("se nel frattempo non si può più: lo dice con la frase del motivo, role=alert, e il tasto è spento", [true, true, true], [testoDi(non).includes(I.fraseMotivo("ponte_non_collegato")), /role="alert"/.test(non), /disabled=""/.test(non.match(/<button\b[^>]*>(?:(?!<\/button>).)*Invia dal telefono(?:(?!<\/button>).)*<\/button>/s)?.[0] ?? "")]);
    c("…e il campo resta scrivibile (il testo non si perde)", false, /<textarea\b[^>]*disabled/.test(non));

    /* ═══ La bolla della coda ═══ */
    gruppo("PONTE · INVIO A MANO · LA BOLLA DELLA CODA IN OGNI STATO (T4)");
    const bollaCoda = (o = {}) => ({
      id: "11111111-1111-4111-8111-111111111111",
      testo: "Buongiorno, ci vediamo domani",
      fase: "in_attesa",
      quando: fa(5_000),
      frase: "In invio dal telefono…",
      incerto: false,
      puoRiprovare: false,
      ...o,
    });
    const messaggio = (b) => P.messaggioDaCoda(b);
    const bolla = (o) => {
      const b = bollaCoda(o);
      return disegna(React.createElement(BollaMessaggio, { messaggio: messaggio(b), coda: { ...b, onRiprova: () => undefined } }));
    };
    const attesa = bolla();
    c("in attesa: il testo e «In invio dal telefono…», con role=status", [true, true, true], [testoDi(attesa).includes("Buongiorno, ci vediamo domani"), testoDi(attesa).includes("In invio dal telefono…"), /role="status"/.test(attesa)]);
    c("…con l'orologio (icona), senza «Riprova»", [true, false], [/lucide-clock/.test(attesa), /Riprova/.test(attesa)]);
    c("in invio: la stessa cosa", true, testoDi(bolla({ fase: "in_invio" })).includes("In invio dal telefono…"));
    const inviata = bolla({ fase: "inviato", frase: "Inviato dal telefono" });
    c("inviato: la spunta con «Inviato», senza la scritta «In invio»", [true, true, false], [/lucide-check/.test(inviata), /aria-label="Inviato"/.test(inviata), /In invio/.test(inviata)]);
    const scaduta = bolla({ fase: "non_inviato", frase: I.fraseMotivo("scaduto"), puoRiprovare: true });
    c("non inviato (scaduto): «Non inviato: …» con il motivo in parole", true, testoDi(scaduta).includes("Non inviato: non è partito entro 10 minuti: il Mac era spento o occupato."));
    c("…l'icona di avviso e il tasto «Riprova» da 44 px", [true, true, true], [/lucide-(circle-alert|alert-circle)/.test(scaduta), /Riprova/.test(scaduta), /min-h-11/.test(scaduta.slice(scaduta.lastIndexOf("<button", scaduta.indexOf("Riprova"))))]);
    c("…il significato non sta nel solo colore (icona + scritta)", true, /lucide-(circle-alert|alert-circle)/.test(scaduta) && testoDi(scaduta).includes("Non inviato"));
    const stop = bolla({ fase: "non_inviato", frase: I.fraseMotivo("stop"), puoRiprovare: false });
    c("STOP: «Non inviato» ma nessun «Riprova»", [true, false], [testoDi(stop).includes("Non inviato: questo cliente ha chiesto di non essere più contattato."), /Riprova/.test(stop)]);
    const incerta = bolla({ fase: "non_inviato", frase: I.fraseMotivo("esito_incerto"), puoRiprovare: true, incerto: true });
    c("esito incerto: dice «Non so se è partito», c'è «Riprova»", [true, true], [testoDi(incerta).includes("Non so se è partito: guarda sul telefono prima di riprovare."), /Riprova/.test(incerta)]);
    c("…senza ripetere «Non inviato:» davanti (non è certo che non sia partito)", false, /Non inviato: non so/i.test(testoDi(incerta)));
    c("…e la domanda di conferma compare solo dopo il tocco", false, testoDi(incerta).includes("Riprovare lo stesso?"));
    c("la bolla è un'uscita: stesso verde dei nostri messaggi, a destra", [true, true], [/bg-\[#d9fdd3\]/.test(attesa), /self-end/.test(attesa)]);
    const hacker = bolla({ testo: "<script>alert(1)</script><b>x</b>" });
    c("il testo è sempre testo, mai HTML", [false, true], [/<script>/.test(hacker), hacker.includes("&lt;script&gt;")]);
    const tutte = [attesa, inviata, scaduta, stop, incerta].map((h) => testoDi(h)).join(" ");
    c("nessuna parola tecnica e nessun emoji nelle bolle", [null, false], [(tutte.match(VIETATE) ?? [null])[0], EMOJI.test([attesa, inviata, scaduta, stop, incerta].join(""))]);
    const normale = disegna(React.createElement(BollaMessaggio, { messaggio: { id: "m1", user_id: "u", lead_id: null, direction: "outbound", from_number: "x", to_number: "y", body: "Ciao!", status: "sent", wa_message_id: "w", error_message: null, created_at: fa(60_000), delivered_at: null, read_at: null } }));
    c("un messaggio vero, senza coda, è disegnato come prima", [true, false, false], [testoDi(normale).includes("Ciao!"), /In invio dal telefono|Non inviato:/.test(normale), /Riprova/.test(normale)]);

    /* ═══ Il sorgente ═══ */
    gruppo("PONTE · INVIO A MANO · IL SORGENTE DEL DISEGNO (T4)");
    const sorgente = (p) => readFileSync(join(radice, p), "utf8");
    const foglio = senzaCommenti(sorgente("src/crm/chatwa/ScriviDalPonte.tsx"));
    c("il foglio: dal basso, tasto «Chiudi» da 44 px, X di serie nascosta", [true, true, true], [/side="bottom"/.test(foglio), /Chiudi/.test(foglio) && /min-h-11/.test(foglio), /\[&>button\]:hidden/.test(foglio)]);
    c("il foglio: all'apertura il fuoco va nel campo", [true, true], [/onOpenAutoFocus/.test(foglio), /preventDefault\(\)/.test(foglio) && /focus\(/.test(foglio)]);
    c("il foglio: invia, se riesce si chiude e si svuota; se no resta aperto col testo", [true, true], [/await api\.invia\(/.test(foglio), /onTesto\(""\)/.test(foglio)]);
    c("la bozza del foglio è propria: non tocca quella della casella", [true, false], [/useState/.test(foglio), /setBozza|api\.bozza/.test(foglio)]);
    c("i punti di codice: il contatore non usa .length", true, /\[\.\.\.testo\]\.length|Array\.from\(testo\)\.length/.test(foglio));
    c("nessun emoji nel codice del foglio", false, EMOJI.test(foglio));
    const cas = senzaCommenti(sorgente("src/crm/chatwa/Casella.tsx"));
    c("la casella non monta più il foglio «Scrivi dal telefono» (31/10/2026)", 0, (cas.match(/<ScriviDalPonte\b/g) ?? []).length);
    const bs = senzaCommenti(sorgente("src/crm/chatwa/BollaMessaggio.tsx"));
    c("la bolla chiede conferma per l'incerto con la frase unica (FRASE_CONFERMA_INCERTO)", [true, true], [/FRASE_CONFERMA_INCERTO/.test(bs), /useState/.test(bs)]);
    c("la bolla: stato annunciato (role=status), nessun emoji", [true, false], [/role="status"/.test(bs), EMOJI.test(bs)]);
    const conv = senzaCommenti(sorgente("src/crm/chatwa/Conversazione.tsx"));
    c("la conversazione mescola la coda solo qui, con unisciConCoda", [true, true], [/unisciConCoda\(/.test(conv), /api\.ponte\?*\.coda/.test(conv)]);
    c("…la risposta AI e il tasto «Rispondi con l'AI» restano sui messaggi veri", [true, true], [/useRispostaAi\(\{[\s\S]{0,200}messaggi,/.test(conv), /messaggi\.some\(/.test(conv)]);
    c("…le bolle della coda non si scelgono per la risposta AI", true, /m\.body\?\.trim\(\)\)\s*&&\s*!bolla \?/.test(conv));
    c("…il riprova passa da api.ponte.riprova", true, /api\.ponte\??\.riprova\(/.test(conv));
    c("…scorre in fondo anche quando arriva una bolla (dipende dalla lunghezza mescolata)", true, /voci\.length/.test(conv));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
