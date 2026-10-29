/** ── PROVE: IL CRM APERTO DA IERI SI ACCORGE DELLA VERSIONE NUOVA ─────────────
 *
 *  Commessa 2026-10-29-chat-aggiorna. Il titolare vedeva sul telefono solo le
 *  chat di ieri: la causa più probabile è la scheda rimasta aperta col codice di
 *  prima. Le regole pure stanno in `src/crm/versione-crm.ts` (che riusa
 *  `shop/versione-vecchia`); qui si provano, più i controlli sul sorgente: il
 *  guscio del CRM e /chat montano l'avviso.
 *
 *  `mod`: i moduli impacchettati da `prove/prove.mjs`. `aiuti`: `{ c, gruppo, radice }`. */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export function proveChatVersione(mod, { c, gruppo, radice }) {
  const V = mod["versione-crm"];
  //  Come la pagina vera: l'avvio è un `import(...)` scritto nella pagina, i pezzi della rotta sono precaricati.
  const pagina = (avvio, rotta) => `<!doctype html><html><head>
    <link rel="modulepreload" href="/assets/${rotta}">
    <link rel="modulepreload" href="/assets/index-LUCIDE1.js">
    </head><body>
    <script>$_TSR.router=({preloads:["/assets/${avvio}"]})<\/script>
    <script type="module" async="">import("/assets/${avvio}")<\/script>
    </body></html>`;
  const ieri = pagina("index-AAAA.js", "CRM.whatsapp-R1.js");

  gruppo("CRM · VERSIONE NUOVA · IL FILE D'AVVIO");
  c("si legge il file d'avvio dall'import() della pagina, non il primo index-* precaricato", "/assets/index-AAAA.js", V.avvioDaHtml(ieri));
  c("anche con le virgolette protette (mappa delle rotte)", "/assets/index-BBBB.js", V.avvioDaHtml(`children:"import(\\"/assets/index-BBBB.js\\")"`));
  c("pagina senza avvio (errore, altra risposta): stringa vuota", "", V.avvioDaHtml("<html>Bad gateway</html>"));
  c("un indirizzo di fuori non conta", "", V.avvioDaHtml(`import("https://altro.example/assets/index-X.js")`));

  gruppo("CRM · VERSIONE NUOVA · LA DECISIONE");
  const base = { avvioQui: "/assets/index-AAAA.js", vista: "", giaRicaricate: [], occupato: false };
  const prima = V.decidiVersione({ ...base, html: ieri });
  c("prima occhiata, stessa versione: niente, e si prende nota dell'impronta", ["niente", true], [prima.cosa, prima.vista.length > 0]);
  c("di nuovo uguale: niente", "niente", V.decidiVersione({ ...base, vista: prima.vista, html: ieri }).cosa);
  const oggiAvvio = pagina("index-NUOVO.js", "CRM.whatsapp-R1.js");
  c("pubblicato un avvio nuovo, casella vuota e nessuna finestra: si ricarica da sola", "ricarica", V.decidiVersione({ ...base, vista: prima.vista, html: oggiAvvio }).cosa);
  c("…anche alla PRIMA occhiata (scheda aperta prima della pubblicazione): l'avvio caricato non è quello pubblicato", "ricarica", V.decidiVersione({ ...base, html: oggiAvvio }).cosa);
  //  ⚠️ Misurato in shop/versione-vecchia: l'avvio NON cambia a ogni pubblicazione, cambia il pezzo toccato.
  const oggiPezzo = pagina("index-AAAA.js", "CRM.whatsapp-R2.js");
  c("stesso avvio ma il pezzo della pagina è cambiato: è una versione nuova lo stesso", "ricarica", V.decidiVersione({ ...base, vista: prima.vista, html: oggiPezzo }).cosa);
  c("c'è qualcosa di scritto o una finestra aperta: NON si ricarica, si avvisa", "avvisa", V.decidiVersione({ ...base, vista: prima.vista, html: oggiPezzo, occupato: true }).cosa);
  const r = V.decidiVersione({ ...base, vista: prima.vista, html: oggiPezzo });
  c("già ricaricata per quell'impronta e ancora diversa (pubblicazione a metà): avviso, mai ricarica a catena", "avvisa",
    V.decidiVersione({ ...base, vista: prima.vista, html: oggiPezzo, giaRicaricate: [r.impronta] }).cosa);
  c("risposta illeggibile (rete, errore 502): niente, e la nota di prima resta", ["niente", prima.vista],
    (({ cosa, vista }) => [cosa, vista])(V.decidiVersione({ ...base, vista: prima.vista, html: "<html>502</html>" })));
  c("senza avvio letto in questa scheda decide solo l'impronta (niente falsi allarmi)", "niente",
    V.decidiVersione({ ...base, avvioQui: "", vista: "", html: oggiAvvio }).cosa);

  gruppo("CRM · VERSIONE NUOVA · QUANDO SI GUARDA");
  const T = 1_000_000;
  c("pagina nascosta: mai", false, V.deveControllare({ ora: T, ultimo: 0, visibile: false, ritorno: true }));
  c("giro dei 60 s: se è passato circa un minuto sì", true, V.deveControllare({ ora: T, ultimo: T - 60_000, visibile: true, ritorno: false }));
  c("giro dei 60 s: dopo 20 s no", false, V.deveControllare({ ora: T, ultimo: T - 20_000, visibile: true, ritorno: false }));
  c("ritorno sulla pagina: subito, anche se il giro era 20 s fa", true, V.deveControllare({ ora: T, ultimo: T - 20_000, visibile: true, ritorno: true }));
  c("pageshow + focus + visibilitychange insieme: una richiesta sola", false, V.deveControllare({ ora: T, ultimo: T - 300, visibile: true, ritorno: true }));
  c("il segno delle ricariche fatte tiene le ultime 8, senza doppioni", ["b", "c", "d", "e", "f", "g", "h", "i"],
    V.segnaRicaricata(["a", "b", "c", "d", "e", "f", "g", "h"], "i").concat(V.segnaRicaricata(["i"], "i").length === 1 ? [] : ["DOPPIONE"]));
  c("segno illeggibile: lista vuota", [], V.leggiRicaricate("{rotto"));

  gruppo("CRM · VERSIONE NUOVA · DOVE È MONTATO (sorgente)");
  const leggi = (f) =>
    readFileSync(join(radice, f), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const crm = leggi("src/routes/CRM.tsx");
  const chat = leggi("src/routes/chat.tsx");
  const avviso = leggi("src/crm/AvvisoVersione.tsx");
  c("il guscio del CRM e /chat montano l'avviso", [true, true], [/<AvvisoVersione\s*\/>/.test(crm), /<AvvisoVersione\s*\/>/.test(chat)]);
  c("l'avviso usa le regole del modulo (non una copia) e dice «Nuova versione del CRM» con «Ricarica»", [true, true, true], [
    /from "@\/crm\/versione-crm"/.test(avviso),
    /Nuova versione del CRM/.test(avviso),
    />\s*Ricarica\s*</.test(avviso),
  ]);
  c("la pagina si rilegge senza cache e con un tetto di tempo", [true, true], [
    /cache:\s*"no-store"/.test(avviso),
    /AbortController/.test(avviso),
  ]);
  c("ogni minuto e al ritorno sulla pagina; tutto staccato a fine vita", [true, true, true], [
    /setInterval\([^]*?60_000\)/.test(avviso),
    ["visibilitychange", "pageshow", "focus"].every((e) => avviso.includes(`addEventListener("${e}"`)),
    ["visibilitychange", "pageshow", "focus"].every((e) => avviso.includes(`removeEventListener("${e}"`)) && /clearInterval/.test(avviso),
  ]);
}
