/** ── IL CRM APERTO DA IERI SI ACCORGE DELLA VERSIONE NUOVA (29/10/2026) ───────
 *
 *  Il titolare vedeva sul telefono solo le chat di ieri, mentre sul computer
 *  arrivavano. La causa più probabile: la scheda, nel browser dentro un'app,
 *  era rimasta aperta col codice di PRIMA della correzione, e il codice nuovo
 *  arriva solo ricaricando. Da qui: ogni minuto circa (pagina visibile) e al
 *  ritorno sulla pagina si rilegge la pagina senza cache e si guarda se è stata
 *  pubblicata una versione nuova.
 *
 *  ⚠️ SI RIUSA `shop/versione-vecchia`, che fa la stessa cosa per la scheda del
 *   cliente e ha già pagato due lezioni misurate sul sito vero:
 *   · il file d'avvio (`/assets/index-*.js`) NON cambia a ogni pubblicazione,
 *     cambia il pezzo toccato: si confronta l'impronta di TUTTI i pezzi che la
 *     pagina nomina con quella vista la prima volta (stesso indirizzo);
 *   · una ricarica per impronta: una pubblicazione a metà non manda la scheda
 *     in ricarica all'infinito.
 *  In più, qui, il file d'avvio caricato contro quello pubblicato: così anche
 *  la PRIMA occhiata di una scheda vecchia se ne accorge (l'impronta da sola ha
 *  bisogno di una prima nota).
 *  ⚠️ Mai ricaricare sotto le mani: con qualcosa di scritto o una finestra
 *   aperta si mostra «Nuova versione del CRM · Ricarica» e decide chi lavora.
 *  ───────────────────────────────────────────────────────────────────────── */
import { improntaDeiProgrammi, programmiDellaPagina } from "@/shop/versione-vecchia";

/** Il file d'avvio della pagina: `import("/assets/index-….js")` scritto nell'HTML
 *  (anche con le virgolette protette dentro la mappa delle rotte). Vuoto se non
 *  c'è: sul dubbio non si conclude niente. */
export function avvioDaHtml(html: string): string {
  const m = /import\(\\?["'](\/assets\/[A-Za-z0-9._-]+\.js)\\?["']\)/.exec(String(html || ""));
  return m ? m[1] : "";
}

export type EsitoVersione =
  /** Niente di nuovo. `vista`: l'impronta da ricordare per questo indirizzo. */
  | { cosa: "niente"; vista: string }
  /** Versione nuova: `impronta` va segnata fra le ricaricate prima di ricaricare. */
  | { cosa: "ricarica" | "avvisa"; impronta: string };

export function decidiVersione(p: {
  /** La pagina appena riletta senza cache. */
  html: string;
  /** Il file d'avvio che QUESTA scheda ha caricato ("" se non si è letto). */
  avvioQui: string;
  /** L'impronta vista su questo indirizzo la prima volta ("" = prima occhiata). */
  vista: string;
  /** Le impronte per cui questa scheda si è già ricaricata. */
  giaRicaricate: string[];
  /** Qualcosa di scritto in una casella o una finestra aperta. */
  occupato: boolean;
}): EsitoVersione {
  const adesso = improntaDeiProgrammi(programmiDellaPagina(p.html));
  //  Una risposta che non nomina pezzi (errore, pagina d'altro) non dice niente.
  if (!adesso) return { cosa: "niente", vista: p.vista };
  const avvioLa = avvioDaHtml(p.html);
  const avvioCambiato = Boolean(p.avvioQui && avvioLa && p.avvioQui !== avvioLa);
  const pezziCambiati = Boolean(p.vista && adesso !== p.vista);
  if (!avvioCambiato && !pezziCambiati) return { cosa: "niente", vista: adesso };
  //  Già ricaricata per questa impronta e ancora diversa: si avvisa, mai a catena.
  if (p.giaRicaricate.includes(adesso)) return { cosa: "avvisa", impronta: adesso };
  return { cosa: p.occupato ? "avvisa" : "ricarica", impronta: adesso };
}

/** Il giro dei 60 s, e il ritorno sulla pagina che guarda subito. `pageshow`,
 *  `focus` e `visibilitychange` arrivano insieme: dentro 10 s ne vale uno. */
export function deveControllare(p: {
  ora: number;
  ultimo: number;
  visibile: boolean;
  ritorno: boolean;
}): boolean {
  if (!p.visibile) return false;
  return p.ora - p.ultimo >= (p.ritorno ? 10_000 : 55_000);
}

/** Dove la scheda ricorda per quali impronte si è già ricaricata (sessionStorage). */
export const SEGNO_RICARICATE = "hg_crm_ricaricate_per";

export function leggiRicaricate(grezzo: string | null): string[] {
  try {
    const l: unknown = JSON.parse(grezzo || "[]");
    return Array.isArray(l) ? l.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function segnaRicaricata(prima: string[], impronta: string): string[] {
  return [...prima.filter((x) => x !== impronta), impronta].slice(-8);
}
