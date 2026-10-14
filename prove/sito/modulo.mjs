/** ── PROVA C5 · IL MODULO CORTO, DISEGNATO SUL SERVER ──────────────────────
 *  Si impacchetta il componente vero e lo si disegna con react-dom/server
 *  (React finto NO: qui serve quello vero). Guarda cosa c'è nella pagina:
 *  campi, tasti, casella del consenso, testi. NON guarda i tocchi né il
 *  calendario: quelli li guarda Playwright (collaudo P2, P3).
 *  ───────────────────────────────────────────────────────────────────────── */
import { createRequire } from "node:module";
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

finisci();
