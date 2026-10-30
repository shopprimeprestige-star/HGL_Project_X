/** ── PROVE: LA GUIDA DELL'ESPORTAZIONE TOTALE (docs e passi del titolare) ──
 *
 *  Commessa 2026-10-30-ponte-storico-completo, compito T3a (PIANO §e).
 *  Prova che la sezione «Riavere tutto lo storico» di `docs/ponte-whatsapp-setup.md`
 *  (e, se c'è, `PASSI-TITOLARE.md` della commessa) dica le cose che servono, che i
 *  comandi citati esistano davvero in `installa.sh` e che nei documenti del repo
 *  non finisca nessun dato di cliente: solo numeri finti (`393331234567`,
 *  `39333000…`) e nessun nome.
 *  Limite dichiarato: i nomi vietati sono una lista fuori dal repo (`nomiVietati`); un
 *  nome non in lista non lo trova nessuna regola, lo trova chi rilegge.
 *
 *  `mod`: i moduli impacchettati da `prove/prove.mjs` (qui non servono). `aiuti`: `{ c, gruppo, radice }`. */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Nomi di clienti che nei documenti del repo non devono comparire. Il repository è
 *  pubblico: i nomi veri NON stanno qui. Si leggono, uno per riga, da un file fuori dal
 *  repo (variabile `HGL_NOMI_VIETATI`, oppure `../commesse/nomi-vietati.txt`) se esiste;
 *  senza quel file resta il campione finto, che prova solo il rilevatore. */
const CAMPIONE_FINTO = ["Cliente Prova"];
export function nomiVietati(radice) {
  const percorso = process.env.HGL_NOMI_VIETATI || join(radice, "..", "commesse", "nomi-vietati.txt");
  if (!existsSync(percorso)) return CAMPIONE_FINTO;
  const righe = readFileSync(percorso, "utf8").split(/\r?\n/).map((r) => r.trim()).filter((r) => r.length >= 4 && !r.startsWith("#"));
  return [...CAMPIONE_FINTO, ...righe];
}

/** Numeri ammessi: quello finto della guida e il prefisso dei dati inventati. */
const FINTO = /^(393331234567|39333000\d*)$/;

/** Le sequenze di 10 o più cifre che NON sono numeri finti (i nomi delle migrazioni, `2026…_nome.sql`, non contano). */
export function numeriVeri(testo) {
  return [...String(testo).matchAll(/\d{10,}(?![\d_])/g)].map((m) => m[0]).filter((n) => !FINTO.test(n));
}

/** Il testo di una sezione `## <titolo>` fino alla prossima `## `. */
export function sezione(testo, titolo) {
  const i = testo.indexOf(`## ${titolo}`);
  if (i < 0) return "";
  const resto = testo.slice(i + 3);
  const f = resto.search(/\n## /);
  return f < 0 ? resto : resto.slice(0, f);
}

export function proveDocumentiExport(_mod, { c, gruppo, radice }) {
  gruppo("PONTE WHATSAPP · LA GUIDA DELL'ESPORTAZIONE TOTALE (compito T3a)");
  const doc = readFileSync(join(radice, "docs/ponte-whatsapp-setup.md"), "utf8");
  const installa = readFileSync(join(radice, "strumenti/ponte-whatsapp/installa.sh"), "utf8");
  const vietati = nomiVietati(radice);
  const sez = sezione(doc, "Riavere tutto lo storico");
  //  I PASSI vivono nella cartella delle commesse, fuori dal repo: se non ci sono si salta.
  const percorsoPassi = join(radice, "..", "commesse", "2026-10-30-ponte-storico-completo", "PASSI-TITOLARE.md");
  const passi = existsSync(percorsoPassi) ? readFileSync(percorsoPassi, "utf8") : null;

  c("la sezione «Riavere tutto lo storico» c'è", true, sez.length > 500);

  // ── Cosa dice ──────────────────────────────────────────────────────────
  const dice = (nome, re, testo = sez) => c(`la guida dice: ${nome}`, true, re.test(testo));
  dice("IDENTITA=Desktop (e il ritorno a Chrome)", /IDENTITA=Desktop/);
  dice("IDENTITA=Chrome come rimedio", /IDENTITA=Chrome/);
  dice("si cambia la riga che c'è, non se ne aggiunge una seconda", /non (?:ne )?aggiung\w+ una seconda/i);
  dice("INVII_ATTIVI=0 fino ai controlli", /INVII_ATTIVI=0/);
  dice("INVII_ATTIVI=1 rimesso il giorno dopo", /INVII_ATTIVI=1/);
  dice("il codice del tipo nel log: tipo=2 è il FULL", /tipo=2/);
  dice("senza tipo=2 il telefono non ha mandato il FULL", /(?:non compare mai|senza)\s+`?tipo=2/i);
  dice("i «Non letti» non devono salire, salvo i messaggi veri arrivati nel frattempo", /salvo[^.\n]*messaggi veri/i);
  dice("i «Non letti» possono scendere di poco", /scend\w+/i);
  dice("non ricollegare più di una volta al giorno", /più di una volta al giorno/i);
  dice("il vecchio «Mac OS» non si toglie prima dei controlli", /Non togliere ancora il vecchio/);
  dice("le tre misure dei doppioni (esterni)", /possibili_doppioni_esterni/);
  dice("le tre misure dei doppioni (interni)", /doppioni_interni/);
  dice("le tre misure dei doppioni (segnaposto «non leggibile»)", /segnaposto_nd/);
  dice("le SELECT sulla chat di un numero (righe per canale e direzione)", /from public\.whatsapp_messages m/i);
  dice("le SELECT sulla chat di un numero (nascita della scheda)", /from public\.crm_leads/i);
  dice("il limite dei 3000 contatti", /3000/);
  dice("il telefono deve suonare anche dopo", /suon/i);
  dice("lo scollegamento chiede SCOLLEGA", /SCOLLEGA/);
  dice("il ritorno indietro (auth.scollegato)", /auth\.scollegato-/);

  // ── La sezione «Le immagini» (T3b) ─────────────────────────────────────
  const img = sezione(doc, "Le immagini");
  c("la sezione «Le immagini» c'è", true, img.length > 800);
  const diceImg = (nome, re) => c(`la guida delle immagini dice: ${nome}`, true, re instanceof RegExp ? re.test(img) : re);
  diceImg("l'interruttore in app_config (ponte_immagini), acceso e spento", /ponte_immagini/.test(img) && /"acceso":true/.test(img) && /"acceso":false/.test(img));
  diceImg("il tetto di 0,8 GB e il piano gratuito da 1 GB", /0,8 GB/.test(img) && /1 GB/.test(img));
  diceImg("come controllare lo spazio (somma di byte in ponte_wa_media)", /sum\(byte\)[\s\S]*ponte_wa_media/.test(img));
  diceImg("la riga di log immagini e i suoi contatori", /ok[\s\S]*scadute[\s\S]*errori[\s\S]*tetto[\s\S]*in_coda/.test(img));
  diceImg("la cancellazione a mano delle foto di un numero (file prima, righe dopo)", /Cancellare le foto di un cliente/.test(img) && /delete from public\.ponte_wa_media where numero/.test(img));
  diceImg("la coda su disco è dato cliente, non va in backup né nei log", /dato cliente/.test(img) && /backup/.test(img));
  diceImg("come spegnere", /spegni/i.test(img));
  diceImg("solo le foto degli ultimi 14 giorni", /14 giorni/.test(img));
  diceImg("la migrazione è quella delle immagini e si annulla dai suoi commenti", /20261030170000_ponte_immagini/.test(img));
  diceImg("niente richieste al telefono per i media scaduti", /non chiede mai al telefono/.test(img));
  c("la guida delle immagini usa il numero finto e non un indirizzo e-mail", [true, 0], [/393331234567/.test(img), [...img.matchAll(/[\w.+-]+@[\w-]+\.[a-z]{2,}/gi)].length]);

  // ── I comandi coincidono con installa.sh ──────────────────────────────
  const sottocomandi = new Set([...installa.matchAll(/^\s+(\w+)\)\s/gm)].map((m) => m[1]));
  const etichetta = installa.match(/^ETICHETTA="([^"]+)"/m)?.[1];
  const testiDaVedere = [["docs", doc], ...(passi ? [["PASSI", passi]] : [])];
  c("installa.sh ha i sottocomandi che la guida usa (installa, stato, chiave, scollega)", true, ["installa", "stato", "chiave", "scollega"].every((s) => sottocomandi.has(s)));
  for (const [dove, testo] of testiDaVedere) {
    const citati = [...testo.matchAll(/\.\/installa\.sh\s+([a-z]+)/g)].map((m) => m[1]);
    c(`${dove}: ogni «./installa.sh <comando>» esiste in installa.sh`, [], citati.filter((s) => !sottocomandi.has(s)));
    const etichette = [...testo.matchAll(/gui\/\$\(id -u\)\/([\w.-]+)/g)].map((m) => m[1]);
    c(`${dove}: ogni servizio launchctl citato è quello di installa.sh`, [], etichette.filter((e) => e !== etichetta));
  }
  c("installa.sh scollega dice di NON togliere ancora il vecchio «Mac OS»", true, /NON togliere ancora il vecchio «Mac OS»/.test(installa) && !/echo "[^"]*: togli il vecchio/.test(installa));
  c("la guida non rimanda a un testo dello script che dice il contrario", false, /anche se il testo dello script/.test(sez));
  c("la guida cita davvero ./installa.sh scollega e ./installa.sh stato", true, /\.\/installa\.sh scollega/.test(sez) && /\.\/installa\.sh stato/.test(sez));

  // ── Nessun dato di cliente nei documenti del repo ─────────────────────
  c("docs: nessuna sequenza di 10+ cifre che non sia un numero finto", [], numeriVeri(doc));
  c("docs: nessun nome di cliente", [], vietati.filter((n) => doc.toLowerCase().includes(n.toLowerCase())));
  c("docs: nessun indirizzo e-mail", [], [...doc.matchAll(/[\w.+-]+@[\w-]+\.[a-z]{2,}/gi)].map((m) => m[0]).filter((m) => !/@(example|crm\.example)\./.test(m)));
  c("la guida usa il numero finto 393331234567 al posto di uno vero", true, /393331234567/.test(sez));
  c("il rilevatore dei nomi lavora sul campione finto", ["Cliente Prova"], CAMPIONE_FINTO.filter((n) => "scritto da Cliente Prova".toLowerCase().includes(n.toLowerCase())));
  //  Il rilevatore funziona (se non trovasse mai niente, le prove sopra sarebbero vuote).
  c("il rilevatore trova un numero vero e lascia passare i finti", ["393339876543"], numeriVeri("393339876543 393331234567 393330001234 11.792 20261029120000_ponte.sql"));

  if (passi) {
    c("PASSI: nessuna sequenza di 10+ cifre che non sia un numero finto", [], numeriVeri(passi));
    c("PASSI: nessun nome di cliente", [], vietati.filter((n) => passi.toLowerCase().includes(n.toLowerCase())));
    const parteA = passi.split(/\n## PARTE B/)[0];
    c("PASSI: si cambia la riga INVII_ATTIVI=1 in INVII_ATTIVI=0, senza aggiungerne una seconda", true, /cambia la riga `INVII_ATTIVI=1` in `INVII_ATTIVI=0`/.test(parteA) && /non (?:ne )?aggiung\w+ una seconda/i.test(parteA));
    c("PASSI: IDENTITA=Desktop, e se la riga c'è già si cambia", true, /IDENTITA=Desktop/.test(parteA) && /se (?:c'è|esiste) già[^.\n]*IDENTITA/i.test(parteA));
    const dopoConfig = parteA.slice(parteA.indexOf("cambia la riga `INVII_ATTIVI=1`"), parteA.indexOf("### I passi"));
    c("PASSI: dopo aver modificato config.env si controlla con ./installa.sh stato", true, /\.\/installa\.sh stato/.test(dopoConfig));
    c("PASSI: i comandi per tornare alla sessione di prima ci sono", true, ["launchctl bootout gui/$(id -u)/it.hgl.ponte-whatsapp", "mv auth auth.nuovo-fallito", "mv auth.scollegato-<data> auth", "launchctl bootstrap gui/$(id -u)"].every((s) => parteA.includes(s)));
    const parteB = passi.split(/\n## PARTE B/)[1] ?? "";
    c("PASSI Parte B: interruttore, tetto 0,8, spazio, cancellazione (rimando alla guida), privacy della cartella, foto di prova", [true, true, true, true, true, true], [/ponte_immagini/.test(parteB), /0,8 GB/.test(parteB), /ponte_wa_media/.test(parteB), /Le immagini/.test(parteB), /non copiarla/.test(parteB), /Prima foto vera/.test(parteB)]);
    c("PASSI: «Non letti» non salgono, salvo messaggi veri arrivati stasera", true, /salvo[^.\n]*messaggi veri/i.test(parteA));
  }
}
