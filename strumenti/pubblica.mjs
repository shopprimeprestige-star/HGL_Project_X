#!/usr/bin/env node
/** ── PUBBLICARE SENZA ROMPERE CHI STA LAVORANDO ────────────────────────────
 *
 *  Segnalazione del committente, con la schermata sotto gli occhi: durante una
 *  consulenza il cliente si è fermato su «Pezzo dell'app non disponibile
 *  (versione aggiornata)» e il consulente ha visto il riquadro arancione
 *  «Problema sul dispositivo del cliente».
 *
 *  ⚠️ PERCHÉ SUCCEDE, ED È NOSTRO. L'applicazione non arriva in un file solo:
 *   arriva a pezzi, e ogni pezzo porta nel nome l'impronta del suo contenuto
 *   (`router-CjhWtIGe.js`). Una pagina aperta PRIMA della pubblicazione
 *   conosce i nomi VECCHI, e li chiede quando servono — cambiando schermata,
 *   aprendo il preventivo, entrando in videochiamata. Cloudflare però tiene
 *   online solo i file dell'ULTIMA pubblicazione: i nomi vecchi rispondono
 *   «non trovato», e la pagina del cliente si spezza a metà consulenza.
 *   Non è un errore raro: succede A OGNI pubblicazione fatta mentre qualcuno
 *   ha la pagina aperta.
 *
 *  ⚠️ IL RIMEDIO NON È RICARICARE. Ricaricare c'è già ed è la rete di
 *   sicurezza, ma è la cosa che il cliente VEDE: la consulenza si ferma, lui
 *   torna sulla schermata d'attesa, e il consulente deve spiegare. La cosa
 *   giusta è non far mai mancare quei file.
 *
 *  Qui si tiene un ARCHIVIO dei pezzi già pubblicati (`.storico-assets/`) e
 *  lo si rimette dentro la cartella da pubblicare insieme a quelli nuovi. I
 *  nomi portano l'impronta del contenuto, quindi non possono darsi fastidio:
 *  un file vecchio e uno nuovo sono due file diversi, e il vecchio continua a
 *  rispondere a chi lo chiede. Le pagine aperte finiscono la consulenza; le
 *  nuove prendono i pezzi nuovi.
 *
 *  L'archivio si pota da solo: quello che non viene ripubblicato da GIORNI_MAX
 *  giorni esce. Una consulenza non dura tre settimane.
 *
 *  ── ⚠️ E C'È UN TETTO, PERCHÉ IL PIANO NE HA UNO ─────────────────────────
 *  Cloudflare accetta al massimo 20.000 file per versione (piano gratuito), e
 *  la pubblicazione si è fermata lì: «This deployment includes 20.138 static
 *  asset files, which exceeds the Workers Free limit». Da nessuna parte si
 *  poteva più pubblicare — né da qui né dal deploy automatico su push.
 *  Due cose non andavano:
 *   · la potatura per data NON scattava mai. Al passo 1 l'archivio intero
 *     torna dentro `dist/client/assets`, e il passo 2 rinfrescava la data di
 *     TUTTO quello che trovava lì: ogni pubblicazione rimetteva a nuovo anche
 *     i pezzi di tre settimane prima, che quindi non scadevano mai. Adesso si
 *     rinfresca solo quello che ha prodotto la COSTRUZIONE di adesso — che è
 *     ciò che «ripubblicato» ha sempre voluto dire.
 *   · ventuno giorni sono troppi per questo ritmo: ogni pubblicazione conia
 *     ~320 pezzi nuovi (cambia il contenuto, cambia l'impronta nel nome), e in
 *     quattro giorni si erano accumulati 20.098 file. Perciò c'è anche un
 *     TETTO in numero: oltre `MASSIMO_ARCHIVIO` escono i più vecchi, che sono
 *     quelli che nessuno può più chiedere.
 *  ⚠️ Il tetto sta ben sotto il limite del piano: la cartella pubblicata è
 *   l'archivio PIÙ i pezzi nuovi, e arrivare al limite spaccato vorrebbe dire
 *   una pubblicazione rifiutata al primo pezzo in più.
 *
 *  Uso:  node strumenti/pubblica.mjs            (costruisce e pubblica)
 *        node strumenti/pubblica.mjs --solo-deploy
 */
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, statSync, utimesSync, rmSync } from "node:fs";
import { join } from "node:path";

const RADICE = process.cwd();
const ASSETS = join(RADICE, "dist", "client", "assets");
const ARCHIVIO = join(RADICE, ".storico-assets");
const GIORNI_MAX = 21;
/** Quanti pezzi al massimo restano in archivio. ~320 per pubblicazione: sono
 *  quasi quaranta versioni raggiungibili, molto più di una giornata di lavoro,
 *  e lasciano 8.000 file di margine sotto il limite del piano. */
const MASSIMO_ARCHIVIO = 16000;
/*  ⚠️ ALZATO DA 12.000, E C'È UNA MISURA SOTTO. Il committente ha visto due
 *   volte in una sera «Importing a module script failed»: la sua scheda era
 *   aperta da ore e in quelle ore ho pubblicato più di dieci volte — ogni
 *   pubblicazione conia centinaia di nomi nuovi, l'archivio era già esatto al
 *   tetto (12.000) e i pezzi che la sua scheda chiedeva erano stati sfoltiti.
 *   Il conto del margine: la cartella pubblicata è l'archivio più i file che
 *   non sono pezzi, che nell'ultima costruzione erano 44 (12.044 in tutto con
 *   12.000 pezzi). Con 16.000 si pubblicano ~16.050 file e restano quasi
 *   4.000 di margine sotto il limite del piano (20.000), abbastanza anche per
 *   una costruzione che cambi tutti i nomi in una volta.
 *   Non è la sola difesa: se un pezzo manca comunque, la pagina si ricarica da
 *   sé (vedi `ricaricaPerPezzoMancante` in src/versione-aperta.ts). Questa
 *   però è quella che il committente NON vede. */

const esegui = (cmd, args) => execFileSync(cmd, args, { stdio: "inherit", cwd: RADICE });

if (!process.argv.includes("--solo-deploy")) {
  console.log("→ costruisco");
  esegui("npm", ["run", "build"]);
}
if (!existsSync(ASSETS)) {
  console.error("✖ non trovo dist/client/assets: la costruzione non è andata a buon fine");
  process.exit(1);
}
mkdirSync(ARCHIVIO, { recursive: true });

//  0. che cosa ha prodotto la COSTRUZIONE di adesso. Si guarda PRIMA di
//     rimettere dentro l'archivio, altrimenti «di adesso» diventa «tutto».
const diAdesso = new Set(readdirSync(ASSETS));

//  1. i pezzi VECCHI tornano nella cartella da pubblicare (senza toccare i nuovi)
let rimessi = 0;
for (const nome of readdirSync(ARCHIVIO)) {
  const dest = join(ASSETS, nome);
  if (existsSync(dest)) continue;
  cpSync(join(ARCHIVIO, nome), dest);
  rimessi += 1;
}

//  2. i pezzi di ADESSO entrano nell'archivio, e quelli ripubblicati si
//     rinfrescano: la potatura guarda l'ultima volta che sono serviti.
const ora = new Date();
let archiviati = 0;
for (const nome of readdirSync(ASSETS)) {
  const dentro = join(ARCHIVIO, nome);
  if (!existsSync(dentro)) { cpSync(join(ASSETS, nome), dentro); archiviati += 1; }
  //  ⚠️ Si rinfresca SOLO ciò che la costruzione di adesso ha prodotto: un
  //   pezzo rimesso online dal passo 1 non è «ripubblicato», è solo tenuto
  //   raggiungibile — e rinfrescarlo rendeva la scadenza impossibile.
  else if (diAdesso.has(nome)) { try { utimesSync(dentro, ora, ora); } catch { /* pazienza */ } }
}

/*  ── ⚠️ QUELLO CHE SERVE ADESSO NON SI TOCCA MAI ─────────────────────────
    Segnalazione del committente: cliccando «fai preventivo» il cliente andava
    in crash e si scollegava in continuazione, e il link mandato su WhatsApp
    restava per sempre su «stiamo preparando la schermata».
    Misurato aprendo il link vero: due pezzi della pagina rispondevano 404 —
    `catalog-*.js` (dentro c'è il listino, cioè tutto) e
    `consulenza-contenuti-*.js`. Non era il codice: era QUESTO script.
    Il conto dei pezzi in archivio era arrivato esatto al tetto (16.000), e la
    sfoltitura qui sotto toglie i più VECCHI per data di nascita. Un file il cui
    contenuto non cambia da mesi — il listino, appunto — tiene lo stesso nome e
    la stessa data di nascita: risultava fra i più vecchi ed è stato cancellato
    dalla cartella che si stava per pubblicare, pur essendo un pezzo della
    costruzione di ADESSO. Il sito è andato online senza.
    Da qui in poi la regola è una sola e vale per tutte e due le potature: un
    pezzo prodotto dalla costruzione di adesso non si cancella, punto. Al
    massimo l'archivio resta un po' sopra il tetto — e sopra il tetto ci sta,
    perché il margine sotto il limite del piano è di quasi quattromila file. */
const intoccabile = (nome) => diAdesso.has(nome);

//  3. potatura: quello che non si pubblica da tre settimane non serve più
const limite = Date.now() - GIORNI_MAX * 24 * 60 * 60 * 1000;
let potati = 0;
for (const nome of readdirSync(ARCHIVIO)) {
  if (intoccabile(nome)) continue;
  const f = join(ARCHIVIO, nome);
  try {
    if (statSync(f).mtimeMs < limite) { rmSync(f); rmSync(join(ASSETS, nome), { force: true }); potati += 1; }
  } catch { /* file sparito nel frattempo */ }
}

//  4. il tetto: se dopo la scadenza sono ancora troppi, escono i più vecchi.
//     «Vecchio» = quando il pezzo è NATO in archivio (la prima volta che è
//     stato pubblicato): è la sua età vera, e non cambia rimettendolo online.
let sfoltiti = 0;
const rimasti = readdirSync(ARCHIVIO).filter((nome) => !intoccabile(nome)).map((nome) => {
  const f = join(ARCHIVIO, nome);
  try { const st = statSync(f); return { nome, quando: st.birthtimeMs || st.mtimeMs }; }
  catch { return null; }
}).filter(Boolean);
if (rimasti.length > MASSIMO_ARCHIVIO) {
  rimasti.sort((a, b) => a.quando - b.quando);
  for (const { nome } of rimasti.slice(0, rimasti.length - MASSIMO_ARCHIVIO)) {
    try { rmSync(join(ARCHIVIO, nome)); rmSync(join(ASSETS, nome), { force: true }); sfoltiti += 1; }
    catch { /* file sparito nel frattempo */ }
  }
}

/*  ── 5. ⚠️ SI CONTROLLA PRIMA DI PUBBLICARE, NON DOPO ────────────────────
    La rete di sicurezza che mancava. Il guasto di oggi — due pezzi della
    costruzione appena fatta cancellati dalla sfoltitura — è andato online
    senza che niente si lamentasse: se ne è accorto il committente, dal
    cliente che non riusciva più ad aprire il preventivo.
    Questo controllo costa una lettura di cartella e rende quel guasto
    impossibile da pubblicare: se manca anche un solo pezzo di ADESSO non si
    pubblica niente. Meglio una pubblicazione che si ferma di un sito che si
    apre a metà. */
const dopoLaPotatura = new Set(readdirSync(ASSETS));
const spariti = [...diAdesso].filter((n) => !dopoLaPotatura.has(n));
if (spariti.length) {
  console.error(
    `✖ ${spariti.length} pezzi della costruzione di adesso non sono più nella cartella da pubblicare:\n   ` +
      spariti.slice(0, 10).join("\n   ") +
      (spariti.length > 10 ? `\n   …e altri ${spariti.length - 10}` : "") +
      "\n  Non pubblico: il sito uscirebbe senza quei pezzi e le pagine che li chiedono resterebbero a metà.",
  );
  process.exit(1);
}

console.log(`→ pezzi delle versioni precedenti rimessi online: ${rimessi} · nuovi in archivio: ${archiviati} · scaduti tolti: ${potati} · tolti per il tetto: ${sfoltiti} · pezzi di adesso tutti presenti: ${diAdesso.size}`);
console.log("→ pubblico");
esegui("npx", ["wrangler", "deploy", "-c", "wrangler.deploy.jsonc"]);

/*  ── 6. LA SORGENTE DEL PROGRAMMA, DEPOSITATA ADESSO ─────────────────────
    Richiesta del committente: poter scaricare TUTTO — dati e programma — per
    installarlo altrove. I dati il gestionale li sa già dare; la sorgente no,
    e non potrà mai: quello che gira su Cloudflare è la costruzione, da cui
    non si torna indietro. L'unico momento in cui la sorgente è in mano a
    qualcuno è QUESTO, ed è qui che si deposita (vedi strumenti/sorgente).
    ⚠️ Se fallisce non ferma niente: il sito è già pubblicato. */
const { depositaSorgente } = await import("./sorgente.mjs");
await depositaSorgente().catch((e) => console.warn("→ sorgente NON depositata:", e?.message || e));
