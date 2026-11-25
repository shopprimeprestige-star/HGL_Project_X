/** ── EMAIL DELLO SHOP · COME SI COMPONE UN MESSAGGIO (R2 · T49 · D53) ─────────────────────────────────
 *  Modulo PURO, forma minima del R2 (testo semplice + html a tabelle, senza immagini). ⚠️ Lo riscrive V2 (struttura a 600 px,
 *  testata, piè con ragione sociale): il file ha un solo proprietario per rilascio; il contratto qui sotto resta.
 *   · variabili a graffa singola, ammesse solo quelle della chiave (`VARIABILI_PER_CHIAVE`): le altre restano com'erano;
 *   · UN SOLO PASSAGGIO sul modello: un valore che contiene `{ref}` o `{{` non si riscrive né si rivaluta;
 *   · html: tutto con escape (anche il testo del titolare); i link solo `https://`, altrimenti niente;
 *   · l'indirizzo del cliente sta solo nella conferma (è l'unica che ha la variabile); telefono e codice fiscale non hanno variabile. */
import { VARIABILI_PER_CHIAVE, type EmailComposta, type ModelloEmail, type Variabili } from "./tipi";

/** Un valore non è mai più lungo di così (un riepilogo di molte righe sta largo; un testo di 100 mila caratteri no). */
const TETTO_VALORE = 5_000;
const LINK = new Set(["link_ordine", "link_tracking"]);

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const html = (s: string) => escape(s).replace(/\r?\n/g, "<br>");

/** Solo `https://`, senza spazi, a capo, virgolette o `<`/`>`: altrimenti vuoto. */
function linkSicuro(v: string): string {
  if (/[\s<>"']/.test(v)) return "";
  try {
    return new URL(v).protocol === "https:" && /^https:\/\//i.test(v) ? v : "";
  } catch {
    return "";
  }
}

/** Il valore di una variabile come testo: stringa o niente, mai «undefined». */
function valore(nome: string, variabili: Variabili): string {
  const v = (variabili as Record<string, unknown>)[nome];
  if (typeof v !== "string") return "";
  const t = v.slice(0, TETTO_VALORE);
  return LINK.has(nome) ? linkSicuro(t) : t;
}

/** Un solo passaggio sul modello: i pezzi di testo del titolare e i valori passano da due funzioni diverse. */
function sostituisci(modello: string, ammesse: readonly string[], variabili: Variabili, pezzo: (s: string) => string, val: (nome: string, v: string) => string): string {
  let fuori = "";
  let da = 0;
  for (const m of modello.matchAll(/\{([a-z_]+)\}/g)) {
    if (!ammesse.includes(m[1])) continue;
    fuori += pezzo(modello.slice(da, m.index)) + val(m[1], valore(m[1], variabili));
    da = m.index + m[0].length;
  }
  return fuori + pezzo(modello.slice(da));
}

const cornice = (titolo: string, corpo: string) =>
  `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(titolo)}</title></head>` +
  `<body style="margin:0;padding:0;background:#f4f4f4"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4"><tr><td align="center" style="padding:24px 12px">` +
  `<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff"><tr><td style="padding:24px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;color:#222222">` +
  `${corpo}</td></tr></table></td></tr></table></body></html>`;

/** Compone il messaggio. Va chiamata dopo `messaggioInviabile`; da sola non lancia mai e non lascia «undefined». */
export function componi(modello: unknown, variabili: unknown): EmailComposta {
  const m = (typeof modello === "object" && modello !== null ? modello : {}) as Partial<ModelloEmail>;
  const v = (typeof variabili === "object" && variabili !== null ? variabili : {}) as Variabili;
  const ammesse: readonly string[] = typeof m.chiave === "string" && Object.hasOwn(VARIABILI_PER_CHIAVE, m.chiave) ? VARIABILI_PER_CHIAVE[m.chiave] : [];
  const modelloOggetto = typeof m.oggetto === "string" ? m.oggetto : "";
  const modelloTesto = typeof m.testo === "string" ? m.testo : "";

  const semplice = (t: string) => sostituisci(t, ammesse, v, (s) => s, (_n, x) => x);
  const oggetto = semplice(modelloOggetto).replace(/\s*[\r\n]+\s*/g, " ").trim();
  const testo = semplice(modelloTesto);
  const corpo = sostituisci(modelloTesto, ammesse, v, html, (nome, x) => (LINK.has(nome) ? (x ? `<a href="${escape(x)}">${escape(x)}</a>` : "") : html(x)));
  return { oggetto, testo, html: cornice(oggetto, corpo) };
}
