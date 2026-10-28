/** ── LE PROVE DELLA PAGINA «LEAD IMPORTATI SEMPLICE» · il disegno ──────────
 *
 *  Commessa 2026-10-28-lead-importati-semplice. Come `prove/sheets.mjs`:
 *  `prove/prove.mjs` chiama `proveLeadSemplicePagina(mod, aiuti)` dopo
 *  `proveSheets`. Le prove di questo file leggono il TESTO dei sorgenti della
 *  pagina (le regole pure stanno in `prove/lead-semplice.mjs`).
 *
 *  ⚠️ `aiuti` = { c, gruppo, radice }, come per `proveSheets`.
 *  ⚠️ Un file ancora vuoto passa: lo riempiono i compiti T4-T7 del piano.
 *  ───────────────────────────────────────────────────────────────────────── */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** I pezzi che la pagina ha ceduto ad altri file (compito T3). Il primo è la
 *  rotta; gli altri si saltano finché non esistono. */
export const FILE_DELLA_PAGINA = [
  "src/routes/CRM.importa.tsx",
  "src/crm/importa/SchedaProssimo.tsx",
  "src/crm/importa/PannelloAssegna.tsx",
  "src/crm/importa/RicercaContatto.tsx",
  "src/crm/importa/SchedaMiei.tsx",
  "src/crm/importa/SchedaGiorno.tsx",
  "src/crm/importa/FinestraElimina.tsx",
  "src/crm/importa/BloccoRitorno.tsx",
  //  T4-T5: i pezzi nuovi del disegno (si saltano finché non esistono).
  "src/crm/importa/PannelloBasso.tsx",
  "src/crm/importa/BarraPillole.tsx",
  "src/crm/importa/PannelloFiltra.tsx",
  "src/crm/importa/Intestazione.tsx",
  "src/crm/importa/FraseGiro.tsx",
  "src/crm/importa/FasciaAvvisi.tsx",
  "src/crm/importa/BarraEsiti.tsx",
];

/** Tra un file e l'altro: una riga col nome e un riempitivo lungo, senza spazi.
 *  Una regex come `[\s\S]{0,400}` o `\s*` non lo attraversa, quindi non può
 *  fingere di trovare un pezzo nel file accanto. (Il più lungo `{0,N}` delle
 *  prove è 8000; il riempitivo è 12000.) */
const separatore = (nome) => `\n/*«««FILE: ${nome}»»»*/\n${"▒".repeat(12000)}\n`;

/** Il sorgente della pagina = la rotta + i file che ne sono stati estratti,
 *  uniti col separatore. Le prove sui GESTI (`segna`, `salta`, `vediDopo`…)
 *  leggono la sola rotta, non questo. */
export function sorgentePagina(radice) {
  return FILE_DELLA_PAGINA.filter((f) => existsSync(join(radice, f)))
    .map((f) => separatore(f) + readFileSync(join(radice, f), "utf8"))
    .join("");
}

export async function proveLeadSemplicePagina(mod, { c, gruppo, radice }) {
  const leggi = (f) => readFileSync(join(radice, f), "utf8");
  const rotta = leggi("src/routes/CRM.importa.tsx");
  const pagina = sorgentePagina(radice);
  const esiste = (f) => existsSync(join(radice, f));

  gruppo("LEAD SEMPLICE · LA PAGINA (sorgente)");
  c("i pezzi nuovi della pagina esistono", [], [
    "PannelloBasso", "BarraPillole", "PannelloFiltra", "Intestazione", "FraseGiro", "FasciaAvvisi", "BarraEsiti", "MenuAltro",
  ].filter((n) => !esiste(`src/crm/importa/${n}.tsx`)));

  // ── scorciatoie: un foglio e la ricerca aperta non le fermano da soli ──
  const bloccato = rotta.match(/bloccato:[\s\S]{0,900}?\n\s*\},\n\s*\);/)?.[0] ?? "";
  c("con «Filtra» o «Altro» aperti le scorciatoie tacciono (bloccato contiene pannello)", true, /pannello !== null/.test(bloccato));
  c("con la ricerca aperta (telefono) tacciono anche 1…4, S, A", true, /ricercaAperta/.test(bloccato));
  c("«/» sul telefono apre la ricerca prima di metterla a fuoco", true, /if \(telefono\) setRicercaAperta\(true\)/.test(rotta));

  // ── la barra degli esiti: un solo elemento, fissa sul telefono ──
  const barra = leggi("src/crm/importa/BarraEsiti.tsx");
  c("BarraEsiti: fixed inset-x-0 bottom-0 sul telefono e md:static sul computer", true,
    /fixed inset-x-0 bottom-0/.test(barra) && /md:static/.test(barra));
  c("BarraEsiti: è uno solo (una sola barra nel DOM della scheda)", 1, (pagina.match(/<BarraEsiti\b/g) ?? []).length);
  c("BarraEsiti: Chiama, WhatsApp e gli esiti ricevuti (1…4)", true,
    /<TastoChiama/.test(barra) && /WhatsApp/.test(barra) && /esiti\.map/.test(barra));
  c("la barra scrive la sua altezza per il Toaster, e CRM.tsx la legge", true,
    /--barra-esiti/.test(barra) && /--barra-esiti/.test(leggi("src/routes/CRM.tsx")));
  c("la pagina lascia il posto alla barra sotto la scheda (padding sul telefono)", true, /pb-40 md:pb-6/.test(rotta));

  // ── 44 px sul telefono: i tasti del disegno nuovo hanno h-11 (o min-h-11) ──
  const alti = {
    "BarraEsiti": /h-12/,
    "BarraPillole": /h-11/,
    "PannelloFiltra": /h-11/,
    "PannelloBasso": /h-11 w-11/,
    "MenuAltro": /min-h-11/,
    "FasciaAvvisi": /min-h-11/,
    "Intestazione": /h-11 w-11/,
  };
  for (const [n, re] of Object.entries(alti))
    c(`${n}: i tasti sono alti almeno 44 px sul telefono (classe)`, true, re.test(leggi(`src/crm/importa/${n}.tsx`)));

  // ── il pannello dal basso ──
  const basso = leggi("src/crm/importa/PannelloBasso.tsx");
  c("PannelloBasso: foglio dal basso (Sheet side=bottom) sul telefono e Popover sul computer", true,
    /<SheetContent[\s\S]{0,40}side="bottom"/.test(basso) && /<Popover\b/.test(basso) && /useIsMobile/.test(basso));
  c("PannelloBasso: il tasto di chiusura è da 44 px (quello di serie è nascosto)", true,
    /\[&>button\]:hidden/.test(basso) && /aria-label="Chiudi"/.test(basso));

  // ── cosa non c'è più ──
  c("la rotta non importa più Testata, Segmento, linguetteDaMostrare, BarraFiltri", false,
    /\b(Testata|Segmento|linguetteDaMostrare|BarraFiltri)\b/.test(rotta.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")));
  c("nessun overflow-x sul contenitore della pagina (la riga delle pillole scorre da sé)", false,
    /<Pagina[^>]*overflow-x/.test(rotta));
  c("la riga delle pillole è la sola che scorre di lato", true, /overflow-x-auto/.test(leggi("src/crm/importa/BarraPillole.tsx")));

  // ── l'avviso, la frase, le pillole ──
  c("l'avviso sul telefono elenca le stesse voci quando si apre", true,
    /voci\.map\(\(v\) => \(\s*<li key=\{v\.chiave\}>/.test(leggi("src/crm/importa/FasciaAvvisi.tsx")) && /fraseAvvisi\(voci\)/.test(leggi("src/crm/importa/FasciaAvvisi.tsx")));
  c("la frase del giro conta la coda intera (coda.length), non la fetta dei filtri", true,
    /coda\.filter\(\(l\) => !inFondo\.has\(l\.id\)\)\.length/.test(rotta) && /<FraseGiro daProvare=\{daProvareInCoda\} fatti=\{coda\.length - daProvareInCoda\}/.test(rotta));
  c("il numero di «Di ritorno» e quello dell'avviso vengono da numeroPillola", true,
    /numeroPillola\("ritorno"/.test(rotta) && /ritorni: nRitorni/.test(rotta) && /ritorniFuoriLista=\{diRitornoFuori\.length\}/.test(rotta));
  c("la pagina costruisce lista e coda con righePagina e dice di ogni riga se è in coda", true,
    /righePagina\(/.test(rotta) && /inCoda: idCoda\.has\(lead\.id\)/.test(rotta));
  c("i vecchi indirizzi passano da conStatoCanonico", true, /conStatoCanonico\(leggiRicercaImporta\(raw\)\)/.test(rotta));
  c("il «Poi» è di 3 sul telefono e 5 sul computer", true, /telefono \? 3 : PROSSIMI_VISIBILI/.test(rotta) && /PROSSIMI_VISIBILI = 5/.test(rotta));
  c("i gesti restano nella rotta (segna, salta, vediDopo, mandaInFondo, cambiaFiltri)", true,
    ["const segna = async", "const salta = async", "const vediDopo = async", "const mandaInFondo", "const cambiaFiltri"].every((g) => rotta.includes(g)));
  c("Elenco completo resta un collegamento vero", true, leggi("src/crm/importa/MenuAltro.tsx").includes('to="/CRM/avanzamento"'));
  c("Carica e Assegna si vedono solo con il permesso", true,
    /permessi=\{\{ "lead\.crea": puoCaricare, "lead\.assegna": puoAssegnare \}\}/.test(rotta));
}
