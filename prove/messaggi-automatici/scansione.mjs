/** ── PROVE: LA SCANSIONE «NESSUN INVIO SALTA L'HELPER» ──
 *
 *  Commessa 2026-10-31-interruttori-automatici, compito T8 (PIANO §f, obiezione 6).
 *  Legge TUTTI i sorgenti di `src/` (commenti tolti) e cerca le tracce di un invio:
 *  `inviaWhatsapp(`, `sendFlow`, `sendContent`, `/fb/sending/`, la chiamata Graph `…/messages`,
 *  `.cloud(`, la creazione del client ManyChat, `/api/whatsapp-send`.
 *  Ogni file con una traccia deve stare nell'ELENCO CHIUSO qui sotto, con la sua dichiarazione;
 *  un file nuovo con una traccia fa fallire la prova finché non lo si dichiara (e la dichiarazione
 *  è controllata sul testo del file). Chi aggiunge un invio automatico senza passare dal
 *  controllo lo scopre qui.
 *
 *  Dichiarazioni:
 *   - porta: il solo luogo dove i client chiamano ManyChat e Graph; `porta.ts` fa il controllo
 *     dell'interruttore PRIMA di `viaCloud` e `viaManychat`;
 *   - gate: chiama la porta (o la rotta d'invio) dichiarando `messaggio:` (una chiave del catalogo
 *     o «manuale») e, dove serve, controlla da sé;
 *   - manuale: invio fatto da una persona, chiama `/api/whatsapp-send` SENZA `automatico`;
 *   - nessun-invio: collegamento e prove (contatto, campi), mai un messaggio.
 *
 *  Dati: solo i sorgenti. `mod`: i moduli impacchettati da `prove/prove.mjs`. `aiuti`:
 *  `{ c, gruppo, radice }`. */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Le tracce di un invio (su testo senza commenti). */
const TRACCE = [
  ["inviaWhatsapp(", /\binviaWhatsapp\(/],
  ["sendFlow", /\bsendFlow\b/],
  ["sendContent", /\bsendContent\b/],
  ["/fb/sending/", /\/fb\/sending\//],
  ["Graph …/messages", /\}\/messages\b|graph\.facebook\.com\/[^\s"'`]*\/messages\b/],
  [".cloud(", /\.cloud\(/],
  ["client ManyChat", /\bclientManychat\(|\bcreaClient\(|api\.manychat\.com/],
  ["/api/whatsapp-send", /\/api\/whatsapp-send/],
];

/** L'ELENCO CHIUSO: file (da `src/`) → dichiarazione. */
const ELENCO = {
  //  La porta: il solo luogo dove i client chiamano ManyChat e Graph.
  "crm/manychat/porta.ts": "porta",
  "crm/manychat/api.ts": "porta",
  "crm/manychat/porta.server.ts": "porta",
  //  Chi dichiara il messaggio.
  "crm/manychat/giro.ts": "gate",
  "routes/hooks/promemoria-whatsapp.ts": "gate",
  "crm/fatture/dati-fattura.server.ts": "gate",
  "routes/api.whatsapp-send.ts": "gate",
  "webinar/promemoria.server.ts": "gate",
  //  Invii di una persona (chat, invito al meet, prova dei modelli, elenco dei lead, impostazioni).
  "crm/ProvaModelliWhatsapp.tsx": "manuale",
  "crm/WhatsAppLeadsPanel.tsx": "manuale",
  "crm/chatwa/useChatWa.ts": "manuale",
  "crm/chatwa/useInvitoMeet.ts": "manuale",
  "routes/CRM.impostazioni.tsx": "manuale",
  //  Collegamento e prove: mai un messaggio. (`pannello.ts`, `pannello.server.ts`, `promemoria/giro.ts`,
  //  `promemoria/pronto.ts`, `prova-modelli.ts` non hanno nessuna traccia: se ne prendono una, la prova
  //  chiede di dichiararli.)
  "routes/api.crm.manychat.ts": "nessun-invio",
};

/** Toglie i commenti (blocchi e righe intere): un URL con `//` dentro una stringa resta. */
const senzaCommenti = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/** Le righe che seguono ogni chiamata a `/api/whatsapp-send` (il corpo che si manda): è lì che si
 *  guarda se c'è `automatico`, non nel testo delle schermate o nei commenti a fine riga. */
const dopoLaRotta = (t) =>
  [...t.matchAll(/["'`][^"'`\n]*\/api\/whatsapp-send["'`]/g)]
    .map((m) => t.slice(m.index, m.index + 1200))
    .join("\n");

export async function proveScansioneMessaggi(mod, { c, gruppo, radice }) {
  const cat = mod["messaggi-automatici/catalogo"];
  const src = join(radice, "src");
  const leggi = (rel) => senzaCommenti(readFileSync(join(src, rel), "utf8"));

  //  Tutti i sorgenti, tranne l'albero generato.
  const file = readdirSync(src, { recursive: true })
    .map((p) => String(p).split("\\").join("/"))
    .filter((p) => /\.(ts|tsx)$/.test(p) && p !== "routeTree.gen.ts" && !/\.d\.ts$/.test(p))
    .sort();
  const testo = new Map(file.map((p) => [p, leggi(p)]));
  const conTracce = file.filter((p) => TRACCE.some(([, re]) => re.test(testo.get(p))));

  gruppo("SCANSIONE · NESSUN INVIO SALTA IL CONTROLLO");
  {
    c(
      "la scansione legge i sorgenti (non un elenco vuoto)",
      true,
      file.length > 200 && conTracce.length > 5,
    );
    c(
      "ogni file con la traccia di un invio è nell'elenco chiuso (se ne manca uno: dichiaralo)",
      [],
      conTracce.filter((p) => !(p in ELENCO)),
    );
    c(
      "ogni voce dell'elenco esiste e ha ancora una traccia (altrimenti si toglie dall'elenco)",
      [],
      Object.keys(ELENCO).filter((p) => !conTracce.includes(p)),
    );
    c(
      "le dichiarazioni sono solo quelle previste",
      ["gate", "manuale", "nessun-invio", "porta"],
      [...new Set(Object.values(ELENCO))].sort(),
    );
  }

  const di = (dich) => Object.keys(ELENCO).filter((p) => ELENCO[p] === dich);

  gruppo("SCANSIONE · LA PORTA");
  {
    const porta = testo.get("crm/manychat/porta.ts");
    const inizio = porta.indexOf("export async function inviaWhatsapp(");
    const corpo = porta.slice(inizio, porta.indexOf("\n}\n", inizio));
    const posGate = corpo.search(/controllaInterruttore\(|porte\.interruttore\(/);
    c(
      "porta.ts: `inviaWhatsapp` controlla l'interruttore PRIMA di viaCloud e di viaManychat",
      true,
      inizio > 0 &&
        posGate >= 0 &&
        posGate < corpo.indexOf("viaCloud(") &&
        posGate < corpo.indexOf("viaManychat("),
    );
    c(
      "porta.ts: la chiamata Cloud e i client ManyChat si raggiungono solo da viaCloud/viaManychat",
      true,
      (porta.match(/porte\.cloud\(/g) ?? []).length >= 1 &&
        porta.indexOf("porte.cloud(") > porta.indexOf("async function viaCloud") &&
        !/porte\.cloud\(/.test(porta.slice(0, porta.indexOf("async function viaCloud"))),
    );
    c(
      "la porta e il client non dichiarano il messaggio: non chiamano `inviaWhatsapp(` (lo fanno i gate)",
      [],
      di("porta").filter(
        (p) => p !== "crm/manychat/porta.ts" && /\binviaWhatsapp\(/.test(testo.get(p)),
      ),
    );
    c(
      "la chiamata Graph `…/messages` sta solo nella porta vera e nel ramo Cloud di api.whatsapp-send",
      ["crm/manychat/porta.server.ts", "routes/api.whatsapp-send.ts"],
      file.filter((p) => TRACCE[4][1].test(testo.get(p))),
    );
  }

  gruppo("SCANSIONE · CHI DICHIARA IL MESSAGGIO (gate)");
  {
    const ammesse = new Set([...cat.CHIAVI_MESSAGGI, "manuale"]);
    //  I valori scritti a mano di `messaggio:` e `automatico:` in TUTTO il codice sono chiavi del catalogo.
    const valori = [];
    for (const p of file) {
      for (const m of testo.get(p).matchAll(/\b(?:messaggio|automatico):\s*"([^"]+)"/g))
        valori.push([p, m[1]]);
    }
    c(
      "ogni `messaggio:`/`automatico:` scritto a mano è una chiave del catalogo o «manuale»",
      [],
      valori.filter(
        ([p, v]) =>
          !ammesse.has(v) && /^[a-z_:]+$/.test(v) && p !== "crm/messaggi-automatici/vista.ts",
      ),
    );

    const giro = testo.get("crm/manychat/giro.ts");
    c(
      "giro.ts: ogni invio dichiara `messaggio` (da chiaveDi; senza chiave non si chiama la porta) e non chiama i client",
      [true, true, false, false],
      [
        /\bmessaggio:\s*chiaveMsg\b/.test(giro),
        /const chiaveMsg = chiaveDi\(/.test(giro) &&
          giro.indexOf("const chiaveMsg = chiaveDi(") < giro.indexOf("await inviaWhatsapp("),
        /\.sendFlow\(|\.sendContent\(/.test(giro),
        /\.cloud\(/.test(giro),
      ],
    );
    const conferma = testo.get("routes/hooks/promemoria-whatsapp.ts");
    c(
      "conferma: dichiara «conferma_consulenza» e non chiama i client",
      [true, false],
      [
        /messaggio:\s*"conferma_consulenza"/.test(conferma),
        /\.sendFlow\(|\.sendContent\(/.test(conferma),
      ],
    );
    const fattura = testo.get("crm/fatture/dati-fattura.server.ts");
    c(
      "fattura: dichiara «dati_fattura» e non chiama i client",
      [true, false],
      [/messaggio:\s*"dati_fattura"/.test(fattura), /\.sendFlow\(|\.sendContent\(/.test(fattura)],
    );

    const rotta = testo.get("routes/api.whatsapp-send.ts");
    const pos = (t) => rotta.indexOf(t);
    const primaDelRamo = Math.min(
      ...["leggiCanale(", "inviaWhatsapp(", "/messages"].map((t) => pos(t)).filter((n) => n >= 0),
    );
    c(
      "api.whatsapp-send: il controllo di `automatico` (messaggioAcceso) viene PRIMA del canale, della porta e della chiamata Graph",
      true,
      pos("body.automatico") >= 0 &&
        pos("messaggioAcceso(") >= 0 &&
        pos("messaggioAcceso(") < primaDelRamo &&
        pos("eChiaveMessaggio(") < primaDelRamo,
    );
    c(
      "api.whatsapp-send: alla porta passa `messaggio` (la chiave, o «manuale» se non c'è `automatico`)",
      true,
      /messaggio:\s*automatico\s*\?\?\s*"manuale"/.test(rotta),
    );

    const webinar = testo.get("webinar/promemoria.server.ts");
    const rottaWebinar = testo.get("routes/api.crm.webinar.ts");
    c(
      "webinar: `automatico` è un parametro esplicito, scritto nel corpo solo se presente; la rotta lo passa una volta sola (all'avvio della diretta)",
      [true, true, 1],
      [
        /automatico\?:\s*MessaggioWebinarAutomatico/.test(webinar) &&
          /type MessaggioWebinarAutomatico = "webinar_in_diretta"/.test(webinar),
        /o\.automatico\s*\?\s*\{\s*automatico:\s*o\.automatico\s*\}\s*:\s*\{\}/.test(webinar) &&
          /\.\.\.campoAutomatico/.test(webinar),
        (rottaWebinar.match(/automatico:\s*"webinar_in_diretta"/g) ?? []).length,
      ],
    );
    c(
      '…e il tasto a mano `azione:"promemoria"` non è mai bloccato: la rotta chiama mandaPromemoria 2 volte, `automatico` compare 1',
      [2, 1],
      [
        (rottaWebinar.match(/mandaPromemoria\(/g) ?? []).length,
        (rottaWebinar.match(/\bautomatico\b/g) ?? []).length,
      ],
    );

    const prenota = testo.get("crm/manychat/prenota.server.ts");
    c(
      "prenota in chat: la porta `config` rilegge l'acceso dal registro con la chiave «prenota_chat»",
      true,
      /messaggioAcceso\("prenota_chat"\)/.test(prenota),
    );
  }

  gruppo("SCANSIONE · GLI INVII A MANO NON CHIEDONO L'INTERRUTTORE");
  {
    c(
      "gli invii a mano chiamano `/api/whatsapp-send` e nel corpo che mandano non c'è `automatico` (altrimenti sarebbero frenati)",
      [],
      di("manuale").filter(
        (p) =>
          !/\/api\/whatsapp-send/.test(testo.get(p)) ||
          /\bautomatico\b/.test(dopoLaRotta(testo.get(p))),
      ),
    );
    c(
      "…e fuori dal webinar nessun file manda `automatico` alla rotta",
      [],
      file.filter(
        (p) =>
          p !== "webinar/promemoria.server.ts" && /\bautomatico\b/.test(dopoLaRotta(testo.get(p))),
      ),
    );
  }

  gruppo("SCANSIONE · COLLEGAMENTO E PROVE: MAI UN MESSAGGIO");
  {
    c(
      "i file «nessun-invio» non contengono sendFlow, sendContent, inviaWhatsapp( né la chiamata Graph …/messages",
      [],
      di("nessun-invio").filter((p) => {
        const t = testo.get(p);
        //  `pannello.ts` e `pronto.ts` possono NOMINARE i percorsi come testo di una frase o di un elenco:
        //  contano solo le chiamate vere.
        return (
          /\.sendFlow\(|\.sendContent\(|\binviaWhatsapp\(|\.cloud\(/.test(t) || TRACCE[4][1].test(t)
        );
      }),
    );
    const rottaManychat = testo.get("routes/api.crm.manychat.ts");
    c(
      "api.crm.manychat legge la riga solo da `leggiRigaConfig` (che passa dal registro): la prova a secco e le risposte non mostrano valori congelati",
      [true, false],
      [/leggiRigaConfig\(\)/.test(rottaManychat), /from\("manychat_config"\)/.test(rottaManychat)],
    );
    const pannelloServer = testo.get("crm/manychat/pannello.server.ts");
    c(
      "leggiRigaConfig rimette nella riga i valori del registro (`conRegistro`) prima di restituirla",
      true,
      /riga:\s*conRegistro\(riga,\s*await leggiRegistro\(\)\)/.test(pannelloServer),
    );
  }

  gruppo("SCANSIONE · NESSUNA CHIAVE MORTA");
  {
    //  Un «punto d'uso» è: la chiave esce da `chiaveDi` (giro, conferma, ricontatti) oppure compare
    //  scritta a mano fuori dal catalogo (fattura, webinar, prenota in chat).
    const daChiaveDi = new Set();
    const tipi = [
      "primo_contatto",
      "richiamo_24h",
      "ritorno",
      "casi_reali",
      "meet_oggi",
      "meet_domani",
      "meet_adesso",
      "promemoria",
      "promemoria_chiamata",
      "promemoria_sede",
      "conferma",
    ];
    for (const tipo of tipi) daChiaveDi.add(cat.chiaveDi({ tipo }));
    for (const v of cat.CATALOGO)
      if (v.chiave.startsWith("stato:"))
        daChiaveDi.add(cat.chiaveDi({ tipo: "ricontatto", stato: v.chiave.slice(6) }));
    daChiaveDi.add(cat.chiaveDi({ tipo: "ricontatto", stato: "da_ricontattare" }));
    const aMano = new Set();
    for (const p of file) {
      if (p.startsWith("crm/messaggi-automatici/")) continue;
      for (const m of testo.get(p).matchAll(/"([a-z_]+(?::[a-z_]+)?)"/g)) aMano.add(m[1]);
    }
    const bloccate = cat.CATALOGO.filter((v) => v.bloccataDalCodice).map((v) => v.chiave);
    c(
      "ogni chiave non bloccata dal codice ha almeno un punto d'uso nel codice",
      [],
      cat.CHIAVI_MESSAGGI.filter(
        (k) => !bloccate.includes(k) && !daChiaveDi.has(k) && !aMano.has(k),
      ),
    );
    c(
      "…e le chiavi che non vengono da `chiaveDi` sono scritte a mano nel posto giusto",
      [true, true, true],
      [
        /messaggio:\s*"dati_fattura"/.test(testo.get("crm/fatture/dati-fattura.server.ts")),
        /"webinar_in_diretta"/.test(testo.get("routes/api.crm.webinar.ts")),
        /"prenota_chat"/.test(testo.get("crm/manychat/prenota.server.ts")),
      ],
    );
  }
}
