/** ── «PROVA I MODELLI»: LE REGOLE (Impostazioni → WhatsApp) ────────────────
 *
 *  Richiesta del titolare, 24/10/2026: mandare un modello a un numero scelto
 *  da lui, con variabili finte, per vedere se arriva. Il riquadro è in
 *  `ProvaModelliWhatsapp.tsx`; qui sta tutto quello che si può provare senza
 *  schermo (`prove/prova-modelli.mjs`).
 *
 *  ⚠️ NIENTE NUMERI IN GIRO: questo file non scrive, non logga, non salva. Il
 *   numero vive nello stato del componente e basta. La riga di
 *   `whatsapp_messages` che ogni invio lascia la scrive la porta unica, come
 *   per ogni altro messaggio: non è di questo riquadro.
 *  ⚠️ NIENTE SCORCIATOIE SULLA PORTA: le frasi d'errore sono quelle di
 *   `rispostaChat` (porta.ts); qui si leggono, non si riscrivono.
 *  ───────────────────────────────────────────────────────────────────────── */
import { MAX_PARAMETRI } from "./manychat/porta";
import {
  META_TEMPLATES,
  MODELLI_MANYCHAT,
  findMetaTemplate,
  type MetaTemplate,
  type MetaTemplateParam,
} from "./wa-meta-templates";

/** Un link che non porta da nessuna parte: è una prova, non una stanza vera. */
export const ESEMPIO_LINK = "https://example.com/prova-modello";

/** Esempi per variabile. Il giorno è un giovedì vero (29/10/2026). */
const ESEMPI: Record<MetaTemplateParam["key"], string> = {
  lead_name: "Mario",
  consultant_name: "Luca",
  appointment_date: "29/10/2026",
  appointment_time: "18:00",
  appointment_day: "giovedì 29 ottobre",
  visit_date: "29/10/2026",
  visit_time: "18:00",
  recontact_date: "29/10/2026",
  recontact_time: "18:00",
  meet_link: ESEMPIO_LINK,
  address: "Via Esempio 1, Roma",
};

/** I valori di partenza del modello, nell'ordine {{1}}, {{2}}… */
export function valoriDiEsempio(t: MetaTemplate): string[] {
  return t.params.map((p) => ESEMPI[p.key] ?? p.example);
}

/** Il testo del modello con i valori al posto dei segnaposto. Un valore vuoto
 *  lascia il segnaposto: si vede cosa manca. */
export function anteprimaTesto(t: MetaTemplate, valori: string[]): string {
  return t.body.replace(/\{\{(\d+)\}\}/g, (tutto, n: string) => {
    const v = (valori[Number(n) - 1] ?? "").trim();
    return v || tutto;
  });
}

/** ── IL NUMERO ─────────────────────────────────────────────────────────────
 *  Con «+» o «00» si prende com'è. Senza prefisso, un cellulare italiano
 *  (3xx, 9-10 cifre) prende +39; il resto si rifiuta: indovinare il paese
 *  vorrebbe dire scrivere a uno sconosciuto. La conferma, poi, mostra il
 *  numero per intero. */
export function numeroPerProva(
  grezzo: string,
): { ok: true; e164: string } | { ok: false; motivo: string } {
  //  Spazi e parentesi non contano: «(+39) 333…» è un «+39».
  const testo = String(grezzo ?? "").replace(/[\s()]/g, "");
  if (!testo) return { ok: false, motivo: "Scrivi il numero a cui mandare la prova." };
  if (/[^\d\s+()\-./]/.test(testo))
    return { ok: false, motivo: "Il numero può avere solo cifre, spazi e il «+» iniziale." };
  const cifre = testo.replace(/\D/g, "");
  let internazionale: string;
  if (testo.startsWith("+")) internazionale = cifre;
  else if (cifre.startsWith("00")) internazionale = cifre.slice(2);
  else if (/^3\d{8,9}$/.test(cifre)) internazionale = `39${cifre}`;
  else
    return {
      ok: false,
      motivo: "Scrivi il numero con il prefisso del paese, per esempio +39 333 1234567.",
    };
  if (internazionale.length < 8 || internazionale.length > 15)
    return { ok: false, motivo: "Il numero non sembra completo: controlla le cifre." };
  return { ok: true, e164: `+${internazionale}` };
}

/** «+39 333 123 4567»: per leggerlo bene nella conferma. Solo i numeri italiani
 *  hanno la spaziatura; gli altri restano com'è. */
export function numeroLeggibile(e164: string): string {
  const m = /^\+39(\d{3})(\d{3})(\d{3,4})$/.exec(e164);
  return m ? `+39 ${m[1]} ${m[2]} ${m[3]}` : e164;
}

/** ── IL CANALE ─────────────────────────────────────────────────────────────
 *  Quello che il riquadro mostra: mai i codici dei flussi, solo se c'è. */
export interface StatoCanale {
  canale: "cloud" | "manychat";
  /** i modelli che hanno un flusso collegato in `manychat_config.flussi` */
  modelliConFlusso: string[];
  /** c'è `MANYCHAT_API_KEY` fra i segreti (mai il valore) */
  chiaveManychat: boolean;
  /** la migrazione M1 è applicata (la tabella `manychat_config` c'è) */
  migrazione: boolean;
}

/** Come `mancaTabella` di `manychat/porta.server.ts` (che non si esporta). */
const tabellaAssente = (e: { code?: string; message?: string }) =>
  ["42P01", "PGRST205"].includes(String(e.code ?? "")) ||
  /does not exist|could not find the table/i.test(String(e.message ?? ""));

/** La riga di `manychat_config` diventa lo stato. Tabella assente → cloud con
 *  «migrazione non applicata» (il codice si pubblica prima delle migrazioni).
 *  Qualunque altro guasto → `null`: dire «cloud» a caso sarebbe una bugia. */
export function statoCanaleDaRiga(
  r: {
    data?: { canale?: string | null; flussi?: Record<string, unknown> | null } | null;
    error?: { code?: string; message?: string } | null;
  },
  chiaveManychat: boolean,
): StatoCanale | null {
  if (r.error) {
    if (!tabellaAssente(r.error)) return null;
    return { canale: "cloud", modelliConFlusso: [], chiaveManychat, migrazione: false };
  }
  const canale = r.data?.canale === "manychat" ? "manychat" : "cloud";
  const modelliConFlusso =
    canale === "manychat"
      ? Object.entries(r.data?.flussi ?? {})
          .filter(([, ns]) => typeof ns === "string" && ns.trim())
          .map(([nome]) => nome)
      : [];
  return { canale, modelliConFlusso, chiaveManychat, migrazione: true };
}

export type FlussoDelModello = "collegato" | "mancante" | "non_serve";

export function flussoDelModello(stato: StatoCanale, modello: string): FlussoDelModello {
  if (stato.canale !== "manychat") return "non_serve";
  return stato.modelliConFlusso.includes(modello) ? "collegato" : "mancante";
}

/** I modelli da mettere nella tendina. Col canale ManyChat solo quelli che
 *  hanno un flusso collegato (gli altri verrebbero rifiutati: la tendina non
 *  propone prove destinate a fallire), nell'ordine: prima i vecchi della Cloud
 *  API ancora collegati, poi quelli di ManyChat. Canale non ancora letto o
 *  Cloud API: la lista di sempre. */
export function modelliDaProvare(stato: StatoCanale | null): MetaTemplate[] {
  if (stato?.canale !== "manychat") return META_TEMPLATES;
  return [...META_TEMPLATES, ...MODELLI_MANYCHAT].filter((t) =>
    stato.modelliConFlusso.includes(t.name),
  );
}

/** La riga sotto la scelta del modello. Vuota finché il canale non è letto. */
export function fraseCanale(stato: StatoCanale | null, modello: string): string {
  if (!stato) return "";
  const nota = stato.migrazione ? "" : " (migrazione non applicata: il canale è quello di serie)";
  if (stato.canale === "cloud") return `Canale attivo: WhatsApp Cloud API${nota}.`;
  const flusso = flussoDelModello(stato, modello);
  const frasi = [
    "Canale attivo: ManyChat.",
    flusso === "collegato"
      ? "Il modello ha un flusso collegato."
      : "Il modello non ha nessun flusso collegato: la prova verrebbe rifiutata.",
  ];
  if (!stato.chiaveManychat) frasi.push("Manca la chiave di ManyChat sul server.");
  return frasi.join(" ");
}

/** ── IL CONTROLLO PRIMA DI MANDARE ─────────────────────────────────────────
 *  Gli errori che si vedono già qui non costano un messaggio al telefono del
 *  titolare né una riga nel registro. */
export function controllaProva(i: {
  numero: string;
  modello: string;
  valori: string[];
  stato: StatoCanale | null;
}): { ok: true; e164: string; valori: string[] } | { ok: false; motivo: string } {
  const t = findMetaTemplate(i.modello);
  if (!t) return { ok: false, motivo: "Scegli un modello." };
  const n = numeroPerProva(i.numero);
  if (!n.ok) return n;
  const valori = t.params.map((_, k) => (i.valori[k] ?? "").trim());
  for (const [k, p] of t.params.entries()) {
    const v = valori[k];
    if (!v) return { ok: false, motivo: `Manca un valore: ${p.description}.` };
    //  Meta rifiuta (132018) a capo, tabulazioni e 4 spazi di fila in una variabile.
    if (/[\n\r\t]| {4}/.test(v))
      return {
        ok: false,
        motivo: `Il valore «${p.description}» non può avere a capo, tabulazioni o quattro spazi di fila.`,
      };
  }
  if (i.stato?.canale === "manychat" && t.params.length > MAX_PARAMETRI)
    return {
      ok: false,
      motivo: `Il modello ha ${t.params.length} variabili: ManyChat ne accetta al massimo ${MAX_PARAMETRI}.`,
    };
  return { ok: true, e164: n.e164, valori };
}

/** Il corpo per `/api/whatsapp-send`. ⚠️ Senza `leadId`: la prova non tocca
 *  nessuna scheda. */
export function corpoProva(t: MetaTemplate, e164: string, valori: string[]) {
  return {
    to: e164,
    templateName: t.name,
    templateLang: t.language,
    templateParams: valori,
  };
}

/** ── L'ESITO IN CHIARO ─────────────────────────────────────────────────────
 *  La frase è quella della porta (`message`); se manca c'è l'`hint`, poi il
 *  codice. Solo l'esito buono nomina il numero. */
export function esitoInChiaro(
  status: number,
  corpo: unknown,
  e164: string,
): { tono: "ok" | "errore"; frase: string } {
  const r = (corpo && typeof corpo === "object" ? corpo : {}) as Record<string, unknown>;
  if (status >= 200 && status < 300 && r.ok === true)
    return {
      tono: "ok",
      frase: `Prova mandata a ${numeroLeggibile(e164)}. Controlla il telefono: può metterci qualche secondo.`,
    };
  if (status === 401)
    return { tono: "errore", frase: "Sessione scaduta: rientra nel CRM e riprova." };
  const testo = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : "");
  const frase =
    testo(r.message) ||
    testo(r.hint) ||
    (testo(r.error)
      ? `Errore: ${testo(r.error)}.`
      : `Il server ha risposto con un errore (${status}).`);
  return { tono: "errore", frase };
}
