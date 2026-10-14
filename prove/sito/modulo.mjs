/** ── PROVA C5 · IL MODULO CORTO, DISEGNATO SUL SERVER ──────────────────────
 *  Si impacchetta il componente vero e lo si disegna con react-dom/server
 *  (React finto NO: qui serve quello vero). Guarda cosa c'è nella pagina:
 *  campi, tasti, casella del consenso, testi. NON guarda i tocchi né il
 *  calendario: quelli li guarda Playwright (collaudo P2, P3).
 *  ───────────────────────────────────────────────────────────────────────── */
import { createRequire } from "node:module";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { carica, leggi, nuovaProva, radice } from "./_comune.mjs";

const { c, vero, finisci } = nuovaProva("modulo corto (disegno)");
const M = await carica("src/landing/booking/ModuloCorto.tsx", "modulo-corto", { reactVero: true });
const { renderToStaticMarkup } = createRequire(join(radice, "package.json"))("react-dom/server");
const { createElement } = createRequire(join(radice, "package.json"))("react");

function disegna(props) {
  return renderToStaticMarkup(createElement(M.ModuloCorto, props));
}
const base = { origine: "consulenza", punto: "protocol", problemaObbligatorio: false, titolo: "Lascia due dati, al resto pensiamo noi." };
const html = disegna(base);
const decodifica = (h) => h.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ");
const testo = decodifica(html);

vero("contenitore con id=modulo", /<section[^>]*id="modulo"/.test(html));
vero("data-barra-nascondi=vista (la barra non lo copre)", /data-barra-nascondi="vista"/.test(html));
vero("titolo come passato", testo.includes(base.titolo));
vero("«Come ti chiami?»", testo.includes("Come ti chiami?"));
vero("«Il tuo numero di telefono»", testo.includes("Il tuo numero di telefono"));
vero("«Quando preferisci essere richiamato?»", testo.includes("Quando preferisci essere richiamato?"));
vero("telefono: type=tel inputMode=tel autoComplete=tel-national", /type="tel"/.test(html) && /inputMode="tel"/.test(html) && /autoComplete="tel-national"/.test(html));
vero("nome: autoComplete=name", /autoComplete="name"/.test(html));
c("tre tasti per la fascia (radiogroup)", 3, (html.match(/role="radio"[^>]*>(Mattina|Pomeriggio|Sera)</g) ?? []).length);
c("otto voci per il problema", 8, (html.match(/role="radio"/g) ?? []).length - 3);
vero("campi con testo da 16 px (text-base) e altezza 48 px (h-12)", (html.match(/h-12[^"]*text-base|text-base[^"]*h-12/g) ?? []).length >= 2);
c("casella del consenso presente, UNA sola", 1, (html.match(/type="checkbox"/g) ?? []).length);
vero("casella del consenso NON spuntata di partenza", !/type="checkbox"[^>]*checked/.test(html));
vero("casella del consenso con il testo provvisorio", testo.includes("Ok a ricevere promemoria su WhatsApp"));
vero("la casella non è obbligatoria (nessun required)", !/required/.test(html));
vero("Protocol: problema facoltativo", testo.includes("(facoltativo)"));
vero("shop: problema obbligatorio (niente «facoltativo»)", !decodifica(disegna({ ...base, origine: "stock", punto: "barra", problemaObbligatorio: true, titolo: "Consulenza gratuita" })).includes("(facoltativo)"));
vero("bottone «Prenota la consulenza gratuita» (variante A)", testo.includes("Prenota la consulenza gratuita"));
vero("sotto il bottone: «Ti richiamiamo noi nell'orario che scegli.»", testo.includes("Ti richiamiamo noi nell'orario che scegli."));
vero("privacy: riga di oggi col link", testo.includes("I tuoi dati sono al sicuro · Trattati secondo il GDPR") && html.includes('href="/privacy-policy"'));
vero("nessun errore mostrato prima dell'invio", !/role="alert"/.test(html));
vero("variante scura: disegna lo stesso", disegna({ ...base, variant: "dark" }).includes('id="modulo"'));
for (const [parola, re] of [["€", /€/], ["cura", /\bcura\b/i], ["ricrescita", /ricrescita/i], ["definitivo", /definitiv/i], ["garantit", /garantit/i], ["guarisce", /guaris/i], ["solo noi", /solo noi/i], ["Trustpilot", /trustpilot/i], ["Bio-Mimetic", /bio-mimetic/i]]) {
  vero(`nessuna parola vietata nel testo visibile: ${parola}`, !re.test(testo));
}
vero("il componente non scrive in localStorage e non usa dangerouslySetInnerHTML", !/localStorage|dangerouslySetInnerHTML/.test(leggi("src/landing/booking/ModuloCorto.tsx").replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "")));

/* ── Il calendario che non arriva non rompe la pagina ──────────────────── */
{
  const S = await carica("src/landing/booking/calendario-sicuro.tsx", "calendario-sicuro", { reactFinto: true });
  const vero_ = () => null;
  const bene = await S.caricaCalendarioSicuro(async () => ({ default: vero_ }));
  vero("calendario che arriva: è il vero", bene.default === vero_);
  let fallita = false;
  const male = await S.caricaCalendarioSicuro(() => Promise.reject(new Error("Failed to fetch dynamically imported module"))).catch(() => {
    fallita = true;
  });
  c("calendario che NON arriva: la promessa non fallisce (niente schermata d'errore)", false, fallita);
  vero("…torna un componente di riserva", typeof male?.default === "function" && male.default !== vero_);
  let chiamato = 0;
  male.default({ alErrore: () => chiamato++ });
  c("…che chiude il calendario (si torna alla conferma)", 1, chiamato);
  //  Errore dentro il calendario già caricato: lo ferma il riparo.
  c("riparo: dopo un errore mostra niente invece della pagina rotta", { errore: true }, S.ProteggiCalendario.getDerivedStateFromError());
  let chiuso = 0;
  const riparo = new S.ProteggiCalendario({ alErrore: () => chiuso++, children: "figlio" });
  riparo.componentDidCatch(new Error("rotto"));
  c("riparo: avvisa che il calendario va chiuso", 1, chiuso);
  riparo.state = { errore: true };
  c("riparo: con l'errore non disegna nulla", null, riparo.render());
  riparo.state = { errore: false };
  c("riparo: senza errore disegna il figlio", "figlio", riparo.render());
  const sorgente = leggi("src/landing/booking/ModuloCorto.tsx").replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "");
  vero("ModuloCorto usa il caricamento sicuro e il riparo", /caricaCalendarioSicuro/.test(sorgente) && /<ProteggiCalendario/.test(sorgente));
  vero("ModuloCorto non importa BookingFunnel con un lazy nudo", !/lazy\(\s*\(\)\s*=>\s*import\("\.\/BookingFunnel"\)\s*\.then\([^)]*\)\s*\)/.test(sorgente.replace(/\s+/g, " ")) || /caricaCalendarioSicuro/.test(sorgente));
  //  Doppio tocco sull'orario: il blocco è un ref (subito), non uno stato (dopo il render).
  vero("doppio tocco sull'orario: blocco con useRef", /fissandoRif\.current/.test(sorgente) && /useRef\(false\)/.test(sorgente));
}

/* ── S4.1 · Le opzioni nuove per /soluzioni, senza cambiare lo shop ──────────
 *  Senza le prop nuove il disegno è IDENTICO alla fotografia G1 (prove/sito/g1/, scattata a d42e5d9
 *  con `collaudo-soluzioni/foto-html.mjs`). Con le prop nuove: testi del Copywriter, niente otto voci,
 *  titolo come nome accessibile, nessun id, rosso e rimandi di oggi. */
{
  const leggiFoto = (nome) => leggi(`prove/sito/g1/${nome}`).trim();
  c("shop (stock/barra, problema obbligatorio): HTML identico alla fotografia G1", leggiFoto("modulo-shop.html"), disegna({ origine: "stock", punto: "barra", problemaObbligatorio: true, titolo: "Consulenza gratuita" }).trim());
  c("Protocol (variante scura): HTML identico alla fotografia G1", leggiFoto("modulo-protocol.html"), disegna({ ...base, variant: "dark" }).trim());
  c("le prop nuove NON dichiarate = come non averle (undefined)", disegna(base), disegna({ ...base, interesse: undefined, testi: undefined, mostraProblema: undefined, mostraTitolo: undefined, ancora: undefined }));

  //  Valori di comodo: la prova guarda che i testi PASSATI arrivino nel disegno, non cosa dice il Copywriter (lo guarda testi.mjs).
  const testi = {
    nome: { etichetta: "ETICHETTA-NOME", segnaposto: "SEGNAPOSTO-NOME" },
    telefono: { etichetta: "ETICHETTA-TEL", segnaposto: "SEGNAPOSTO-TEL", aiuto: "AIUTO-TEL" },
    fascia: { etichetta: "ETICHETTA-FASCIA" },
    bottone: "BOTTONE-PROVA",
    sotto: "SOTTO-PROVA",
    errori: { nome: "ERR-NOME", telefono: "ERR-TEL", fascia: "ERR-FASCIA", invio: "ERR-INVIO" },
    conferma: { titolo: "CONFERMA-TITOLO", testo: "CONFERMA-TESTO" },
  };
  const foglio = { origine: "consulenza", punto: "soluzioni", problemaObbligatorio: false, titolo: "TITOLO-ACCESSIBILE", testi, mostraProblema: false, mostraTitolo: false, ancora: null, interesse: "trapianto" };
  const h = disegna(foglio);
  const t = decodifica(h);

  c("mostraProblema=false: restano solo i 3 tasti della fascia, niente 8 voci", 3, (h.match(/role="radio"/g) ?? []).length);
  vero("mostraProblema=false: nemmeno la legenda del problema", !t.includes("Qual è il problema") && !/Altro: scrivilo tu/.test(t));
  vero("mostraTitolo=false: nessun titolo h3", !/<h3/.test(h));
  vero("mostraTitolo=false: il titolo passato è il nome accessibile", /<section[^>]*aria-label="TITOLO-ACCESSIBILE"/.test(h) && !/aria-labelledby="mc-titolo"/.test(h));
  vero("ancora=null: nessun id sul contenitore", !/<section[^>]*\bid=/.test(h));
  vero("ancora='x': l'id è quello dato", /<section[^>]*id="x"/.test(disegna({ ...base, ancora: "x" })));
  vero("senza ancora: id=modulo come oggi", /<section[^>]*id="modulo"/.test(disegna(base)));
  vero("etichette e segnaposto dei testi", t.includes("ETICHETTA-NOME") && t.includes("ETICHETTA-TEL") && t.includes("ETICHETTA-FASCIA") && h.includes('placeholder="SEGNAPOSTO-NOME"') && h.includes('placeholder="SEGNAPOSTO-TEL"'));
  vero("aiuto sotto il telefono, legato al campo (aria-describedby)", t.includes("AIUTO-TEL") && /id="mc-aiuto-tel"/.test(h) && /<input[^>]*id="mc-tel"[^>]*aria-describedby="mc-aiuto-tel"|<input[^>]*aria-describedby="mc-aiuto-tel"[^>]*id="mc-tel"/.test(h));
  vero("bottone e riga sotto dei testi (mai la variante B)", t.includes("BOTTONE-PROVA") && t.includes("SOTTO-PROVA") && !t.includes("Prenota la consulenza gratuita") && !t.includes("Ti richiamiamo noi nell'orario che scegli."));
  vero("le etichette di oggi non ci sono più", !t.includes("Come ti chiami?") && !t.includes("Il tuo numero di telefono") && !t.includes("Quando preferisci essere richiamato?"));
  vero("riga privacy IDENTICA a quella di oggi (testo e link)", t.includes("I tuoi dati sono al sicuro · Trattati secondo il GDPR") && h.includes('href="/privacy-policy"'));
  vero("la casella del promemoria resta com'è: una, non spuntata", (h.match(/type="checkbox"/g) ?? []).length === 1 && !/type="checkbox"[^>]*checked/.test(h) && t.includes("Ok a ricevere promemoria su WhatsApp"));
  vero("nessun collegamento a WhatsApp né telefono cliccabile", !/href="[^"]*(wa\.me|whatsapp|tel:)/i.test(h));
  vero("nessun rosso #FF3B3B nel disegno", !/#ff3b3b/i.test(h));
  vero("fasce di oggi (mattina, pomeriggio, sera)", ["Mattina", "Pomeriggio", "Sera"].every((f) => t.includes(f)));
  vero("nessuna parola vietata nel testo visibile anche col foglio", [/€/, /\bcura\b/i, /garantit/i, /solo noi/i].every((re) => !re.test(t)));

  //  Il codice: il lead e gli eventi portano l'interesse, gli errori vengono dai testi, il rosso è quello di oggi.
  const sorgente = leggi("src/landing/booking/ModuloCorto.tsx").replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "");
  vero("l'interesse va nel lead (sito: …)", /sito[^;]*interesse/.test(sorgente.replace(/\s+/g, " ")));
  vero("l'interesse va negli eventi del modulo", /eventoModulo[\s\S]{0,400}interesse/.test(sorgente));
  vero("gli errori dei campi vengono dai testi (testi.errori)", /testi\.errori/.test(sorgente));
  vero("l'errore d'invio dei testi, senza rimando a WhatsApp", /testi\?*\.errori\.invio/.test(sorgente) && !/wa\.me|api\.whatsapp/i.test(sorgente));
  vero("nessun #FF3B3B nel sorgente", !/#ff3b3b/i.test(sorgente));
  vero("la conferma ha il fuoco e aria-live (come oggi)", /confermaRif\.current\?\.focus\(\)/.test(sorgente) && /aria-live="polite"/.test(sorgente) && /tabIndex=\{-1\}/.test(sorgente));
  vero("il primo campo sbagliato prende il fuoco", /fuocoSu\(primo\)/.test(sorgente));
  vero("onStato dice al foglio se ci sono dati e se è inviato (solo conteggi)", /onStato\?\.\(\{\s*haDati:[^}]*inviato:\s*fase === "inviato"\s*\}\)/.test(sorgente));
  vero("il pulsante del calendario, coi testi, non eredita il fondo scuro del tema", /testi\s*\?[^:]*border-\[#0A1430\]\/40 bg-white/.test(sorgente.replace(/\s+/g, " ")));
}

/* ── S4.4 · Il link alla consulenza è scritto in un posto solo ───────────────
 *  «/#prenota» sta in `testi-sito.ts` (LINK_CONSULENZA); gli articoli del blog lo importano, non lo riscrivono. */
{
  const scritto = [];
  const cerca = (d) => {
    for (const v of readdirSync(join(radice, d), { withFileTypes: true })) {
      const p = `${d}/${v.name}`;
      if (v.isDirectory()) cerca(p);
      else if (/\.tsx?$/.test(v.name) && /["'`]\/#prenota["'`]/.test(readFileSync(join(radice, p), "utf8"))) scritto.push(p);
    }
  };
  cerca("src");
  c('«"/#prenota"» scritto a mano solo in testi-sito.ts', ["src/landing/testi-sito.ts"], scritto);
  const articolo = leggi("src/routes/blog.$slug.tsx");
  vero("l'articolo del blog importa LINK_CONSULENZA da testi-sito", /import\s*\{[^}]*\bLINK_CONSULENZA\b[^}]*\}\s*from\s*"@\/landing\/testi-sito"/.test(articolo));
  vero("il bottone dell'articolo usa LINK_CONSULENZA", /<a href=\{LINK_CONSULENZA\}/.test(articolo));
}

finisci();
